// Speech-to-text with Whisper on Groq's free tier (no credit card). Works from any browser,
// because the browser only uploads the recording to this local server.
import { readConfig } from "./env.ts";
import { HttpError } from "./http.ts";

export type Transcript = {
  text: string;
  language?: string;
  duration?: number;
  words?: { word: string; start: number; end: number }[];
  segments?: { start: number; end: number; text: string }[];
};

// Neutral Traditional-Chinese hint: nudges Whisper to write 繁體 without suggesting any words.
const ZH_PROMPT = "以下是台灣華語。";

export async function transcribe(audio: Buffer, lang: "zh" | "en" | "auto", fileName = "take.wav"): Promise<Transcript> {
  const { groqKey, groqModel } = readConfig();
  if (!groqKey) throw new HttpError(400, "GROQ_API_KEY is empty in .env");
  const models = groqModel ? [groqModel] : ["whisper-large-v3", "whisper-large-v3-turbo"];
  let last: unknown;
  for (const model of models) {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(audio)]), fileName);
    form.append("model", model);
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");
    form.append("timestamp_granularities[]", "segment");
    form.append("temperature", "0");
    if (lang !== "auto") form.append("language", lang);
    if (lang === "zh") form.append("prompt", ZH_PROMPT);

    let res: Response;
    try {
      res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey}` },
        body: form,
      });
    } catch {
      throw new HttpError(502, "Can't reach Groq. Check your internet connection.");
    }
    if (res.status === 401) throw new HttpError(401, "Groq rejected the key. Check GROQ_API_KEY in .env.");
    if (res.status === 429) {
      const retry = Number(res.headers.get("retry-after") ?? 20);
      throw new HttpError(429, "Groq's free-tier limit reached for now", { retryAfter: retry });
    }
    if (res.status === 404 || (res.status === 400 && /model/i.test(await res.clone().text()))) {
      last = new HttpError(404, `Groq model ${model} isn't available`);
      continue;
    }
    if (!res.ok) throw new HttpError(502, `Groq error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return (await res.json()) as Transcript;
  }
  throw last;
}
