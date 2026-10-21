import { readFileSync } from "node:fs";
import { join } from "node:path";

export const ROOT = join(import.meta.dirname, "..");

export type Config = {
  geminiKey: string;
  geminiModel: string;
  azureKey: string;
  azureRegion: string;
  groqKey: string;
  groqModel: string; // speech-to-text
  groqChatModel: string;
};

// Read on every request, so keys pasted into .env work without restarting the app.
export function readConfig(): Config {
  let env: Record<string, string> = {};
  try {
    env = parseEnv(readFileSync(join(ROOT, ".env"), "utf8"));
  } catch {
    // No .env yet: everything shows as "not configured".
  }
  const pick = (key: string) => (env[key] || process.env[key] || "").trim();
  return {
    geminiKey: pick("GEMINI_API_KEY"),
    geminiModel: pick("GEMINI_MODEL"),
    azureKey: pick("AZURE_SPEECH_KEY"),
    azureRegion: pick("AZURE_SPEECH_REGION").toLowerCase().replace(/[\s_-]+/g, "") || "southeastasia",
    groqKey: pick("GROQ_API_KEY"),
    groqModel: pick("GROQ_STT_MODEL"),
    groqChatModel: pick("GROQ_CHAT_MODEL"),
  };
}

export function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.replace(/^﻿/, "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    else if (value.includes(" #")) value = value.slice(0, value.indexOf(" #")).trim();
    out[key] = value;
  }
  return out;
}
