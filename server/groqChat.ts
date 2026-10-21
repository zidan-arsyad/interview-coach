// Chat on Groq (OpenAI-compatible API). Replies in well under a second, so it runs the mock
// interviewer; strict JSON-schema output keeps the reply in the shape the app expects.
import { readConfig } from "./env.ts";
import { HttpError } from "./http.ts";
import { parseLoose, type LlmRequest } from "./gemini.ts";

export const GROQ_CHAT_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];

/** Gemini's OpenAPI-style schema (upper-case types) → JSON Schema for strict structured output. */
export function toJsonSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== "object") return schema;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (k === "type") out.type = String(v).toLowerCase();
    else if (k === "properties") out.properties = Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([pk, pv]) => [pk, toJsonSchema(pv)]));
    else if (k === "items") out.items = toJsonSchema(v);
    else out[k] = v;
  }
  if (out.type === "object") out.additionalProperties = false;
  return out;
}

export async function callGroqChat(model: string, req: LlmRequest, timeoutMs = 30_000): Promise<unknown> {
  const { groqKey } = readConfig();
  if (!groqKey) throw new HttpError(400, "GROQ_API_KEY is empty in .env");
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: req.system },
      ...req.messages.map((m) => ({ role: m.role === "model" ? "assistant" : "user", content: m.text })),
    ],
    temperature: req.temperature ?? 0.7,
    // Reasoning tokens count against this limit too, so leave room.
    max_completion_tokens: Math.max(req.maxTokens ?? 4096, 4096),
    response_format: req.schema
      ? { type: "json_schema", json_schema: { name: "reply", schema: toJsonSchema(req.schema), strict: true } }
      : { type: "json_object" },
  };
  if (model.startsWith("openai/gpt-oss")) body.reasoning_effort = "low";

  let res: Response;
  try {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if ((err as Error).name === "TimeoutError") throw new HttpError(504, "Groq took too long to answer");
    throw new HttpError(502, "Can't reach Groq. Check your internet connection.");
  }
  if (res.status === 401) throw new HttpError(401, "Groq rejected the key. Check GROQ_API_KEY in .env.");
  if (res.status === 429) throw new HttpError(429, "Groq's free-tier limit reached for now", { retryAfter: Number(res.headers.get("retry-after") ?? 20) });
  if (res.status === 404) throw new HttpError(404, `Groq model ${model} isn't available`);
  if (res.status >= 500) throw new HttpError(503, "Groq is overloaded right now");
  if (!res.ok) throw new HttpError(502, `Groq error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content ?? "";
  if (!text) throw new HttpError(502, "Groq returned no answer");
  return parseLoose(text);
}
