// Calls to the local server (server/index.ts).

export class ApiError extends Error {
  status: number;
  retryAfter?: number;
  constructor(status: number, message: string, retryAfter?: number) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the Interview Coach server. Is its window still open?");
  }
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string; retryAfter?: number };
    throw new ApiError(res.status, json.error ?? `Request failed (${res.status})`, json.retryAfter);
  }
  return (await res.json()) as T;
}

export type Status = {
  ai: boolean; // Groq or Gemini key set
  gemini: boolean;
  azure: boolean;
  groq: boolean;
  region: string;
  model: string;
  detailsFilled: number;
  detailsTotal: number;
};
export type Transcript = {
  text: string;
  language?: string;
  words?: { word: string; start: number; end: number }[];
  segments?: { start: number; end: number; text: string }[];
};
export type DetailItem = { id: string; title: string; hint: string; answer: string };
export type LlmMessage = { role: "user" | "model"; text: string };
export type LlmRequest = { system: string; messages: LlmMessage[]; schema?: unknown; temperature?: number; maxTokens?: number };

export const api = {
  status: () => request<Status>("GET", "/api/status"),
  speechToken: () => request<{ token: string; region: string }>("GET", "/api/speech-token"),
  details: () => request<DetailItem[]>("GET", "/api/details"),
  saveDetails: (answers: Record<string, string>) => request<DetailItem[]>("PUT", "/api/details", { answers }),
  sessions: () => request<{ file: string; savedAt: string; summary?: string; rating?: number }[]>("GET", "/api/sessions"),
  session: (file: string) => request<unknown>("GET", `/api/sessions/${encodeURIComponent(file)}`),
  saveSession: (data: unknown) => request<{ file: string }>("POST", "/api/sessions", data),
  selftestGroq: () => request<Transcript & { sample: boolean }>("GET", "/api/selftest/groq"),

  async transcribe(wav: Blob, lang: "zh" | "en" | "auto"): Promise<Transcript> {
    const send = () => fetch(`/api/transcribe?lang=${lang}`, { method: "POST", headers: { "Content-Type": "audio/wav" }, body: wav });
    let res: Response;
    try {
      res = await send();
      if (res.status === 429) {
        const json = (await res.json().catch(() => ({}))) as { retryAfter?: number };
        await new Promise((r) => setTimeout(r, Math.min(Math.max(json.retryAfter ?? 10, 3), 30) * 1000));
        res = await send();
      }
    } catch {
      throw new ApiError(0, "Can't reach the Interview Coach server.");
    }
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      throw new ApiError(res.status, json.error ?? "Transcription failed");
    }
    return (await res.json()) as Transcript;
  },

  async tts(text: string, voice: string, rate = 1): Promise<Blob> {
    let res: Response;
    try {
      res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice, rate }) });
    } catch {
      throw new ApiError(0, "Can't reach the Interview Coach server.");
    }
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      throw new ApiError(res.status, json.error ?? "Text-to-speech failed");
    }
    return res.blob();
  },

  /** Gemini call that waits out one free-tier rate limit before giving up. */
  async llm<T>(req: LlmRequest, onWait?: (seconds: number) => void): Promise<T> {
    try {
      return (await request<{ data: T }>("POST", "/api/llm", req)).data;
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 429) throw err;
      const wait = Math.min(Math.max(err.retryAfter ?? 20, 5), 70);
      onWait?.(wait);
      await new Promise((r) => setTimeout(r, wait * 1000));
      return (await request<{ data: T }>("POST", "/api/llm", req)).data;
    }
  },
};
