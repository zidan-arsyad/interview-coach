import { readConfig } from "./env.ts";
import { HttpError } from "./http.ts";

export type LlmMessage = { role: "user" | "model"; text: string };
export type LlmRequest = {
  system: string;
  messages: LlmMessage[];
  schema?: unknown; // Gemini responseSchema (OpenAPI subset, upper-case types)
  temperature?: number;
  maxTokens?: number;
};

// Tried in order when GEMINI_MODEL is empty; one that's missing or overloaded falls through to the next.
const DEFAULT_MODELS = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-flash-lite-latest"];
const rejectsThinkingLevel = new Set<string>();

export function geminiModels(): string[] {
  const { geminiModel } = readConfig();
  return geminiModel ? [geminiModel] : DEFAULT_MODELS;
}

/** Errors worth trying another model or provider for: missing model, rate limit, overload, timeout. */
export function retryable(err: unknown): boolean {
  return err instanceof HttpError && [404, 408, 429, 500, 502, 503, 504].includes(err.status);
}

export async function callGemini(model: string, req: LlmRequest, timeoutMs = 60_000): Promise<unknown> {
  const { geminiKey } = readConfig();
  if (!geminiKey) throw new HttpError(400, "GEMINI_API_KEY is empty in .env");
  const generationConfig: Record<string, unknown> = {
    temperature: req.temperature ?? 0.7,
    maxOutputTokens: req.maxTokens ?? 4096,
    responseMimeType: "application/json",
  };
  if (req.schema) generationConfig.responseSchema = req.schema;
  if (!rejectsThinkingLevel.has(model)) generationConfig.thinkingConfig = { thinkingLevel: "low" };

  const body = {
    systemInstruction: { parts: [{ text: req.system }] },
    contents: req.messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    generationConfig,
  };

  let res = await post(model, geminiKey, body, timeoutMs);
  if (res.status === 400 && generationConfig.thinkingConfig) {
    const detail = await res.clone().text();
    if (/thinking/i.test(detail)) {
      rejectsThinkingLevel.add(model);
      delete generationConfig.thinkingConfig;
      res = await post(model, geminiKey, body, timeoutMs);
    }
  }

  if (res.status === 404) throw new HttpError(404, `Gemini model ${model} isn't available for this key`);
  if (res.status === 429) {
    const detail = await res.text();
    const retry = Number(/"retryDelay":\s*"(\d+)/.exec(detail)?.[1] ?? 30);
    throw new HttpError(429, "Gemini free-tier limit reached", { retryAfter: retry });
  }
  if (res.status === 400 || res.status === 403) {
    const detail = await res.text();
    if (/API key not valid|API_KEY_INVALID|PERMISSION_DENIED/i.test(detail)) throw new HttpError(401, "Gemini rejected the key. Check GEMINI_API_KEY in .env.");
    throw new HttpError(502, `Gemini error ${res.status}: ${detail.slice(0, 300)}`);
  }
  if (res.status >= 500) throw new HttpError(503, "Gemini is overloaded right now");
  if (!res.ok) throw new HttpError(502, `Gemini error ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  };
  const candidate = json.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
  if (!text) throw new HttpError(502, `Gemini returned no answer (${candidate?.finishReason ?? "no candidates"})`);
  return parseLoose(text);
}

async function post(model: string, key: string, body: unknown, timeoutMs: number): Promise<Response> {
  try {
    return await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if ((err as Error).name === "TimeoutError") throw new HttpError(504, "Gemini took too long to answer");
    throw new HttpError(502, "Can't reach Gemini. Check your internet connection.");
  }
}

export function parseLoose(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.search(/[[{]/);
    const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        // fall through
      }
    }
    throw new HttpError(502, "The AI's answer wasn't valid JSON");
  }
}
