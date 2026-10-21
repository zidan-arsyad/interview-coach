// Picks the AI for each request: Groq first (fast), then Gemini. If one is missing, rate limited,
// overloaded or returns broken JSON, the next one answers, so a busy free tier doesn't stop practice.
import { readConfig } from "./env.ts";
import { HttpError } from "./http.ts";
import { callGemini, geminiModels, retryable, type LlmRequest } from "./gemini.ts";
import { GROQ_CHAT_MODELS, callGroqChat } from "./groqChat.ts";

type Provider = { name: string; call: () => Promise<unknown> };

let lastModel = "";

export function currentModel(): string {
  const { groqKey, groqChatModel, geminiKey } = readConfig();
  if (lastModel) return lastModel;
  if (groqKey) return groqChatModel || GROQ_CHAT_MODELS[0];
  return geminiKey ? geminiModels()[0] : "none";
}

export async function generate(req: LlmRequest): Promise<{ data: unknown; model: string }> {
  const { groqKey, groqChatModel, geminiKey } = readConfig();
  const providers: Provider[] = [];
  if (groqKey) {
    const models = groqChatModel ? [groqChatModel] : GROQ_CHAT_MODELS;
    // The first model gets a second try: its occasional broken-JSON reply usually works on retry.
    for (const model of [models[0], ...models]) providers.push({ name: model, call: () => callGroqChat(model, req) });
  }
  // Gemini is the backup: keep its wait short so a busy moment doesn't stall the interview.
  if (geminiKey) for (const model of geminiModels()) providers.push({ name: model, call: () => callGemini(model, req, 30_000) });
  if (!providers.length) throw new HttpError(400, "No AI key in .env: add GROQ_API_KEY or GEMINI_API_KEY");

  let lastError: unknown;
  for (const p of providers) {
    try {
      const data = await p.call();
      lastModel = p.name;
      return { data, model: p.name };
    } catch (err) {
      lastError = err;
      if (!retryable(err) && !(err instanceof HttpError && err.status === 401)) throw err;
      console.warn(`  ${p.name}: ${(err as Error).message.slice(0, 120)}; trying the next model`);
    }
  }
  throw lastError;
}
