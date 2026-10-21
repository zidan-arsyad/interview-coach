import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ROOT, readConfig } from "./env.ts";
import { HttpError } from "./http.ts";

let cachedToken: { id: string; token: string; expires: number } | null = null;

/** A short-lived token the browser's Speech SDK uses, so the key itself never leaves this machine's server. */
export async function speechToken(): Promise<{ token: string; region: string }> {
  const { azureKey, azureRegion } = readConfig();
  if (!azureKey) throw new HttpError(400, "AZURE_SPEECH_KEY is empty in .env");
  const id = `${azureRegion}:${createHash("sha1").update(azureKey).digest("hex")}`;
  if (cachedToken?.id === id && cachedToken.expires > Date.now()) return { token: cachedToken.token, region: azureRegion };

  let res: Response;
  try {
    res = await fetch(`https://${azureRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": azureKey, "Content-Length": "0" },
    });
  } catch {
    throw new HttpError(502, `Can't reach Azure in region "${azureRegion}". Check AZURE_SPEECH_REGION in .env and your internet connection.`);
  }
  if (res.status === 401 || res.status === 403) throw new HttpError(401, "Azure rejected the key. Check AZURE_SPEECH_KEY and that AZURE_SPEECH_REGION matches the resource's region.");
  if (!res.ok) throw new HttpError(502, `Azure token request failed (${res.status}).`);
  const token = await res.text();
  cachedToken = { id, token, expires: Date.now() + 8 * 60_000 }; // tokens last 10 minutes
  return { token, region: azureRegion };
}

/** Neural text-to-speech as MP3. Results are cached on disk, so repeating a line costs nothing. */
export async function synthesize(text: string, voice: string, rate = 1): Promise<Buffer> {
  const { azureKey, azureRegion } = readConfig();
  if (!azureKey) throw new HttpError(400, "AZURE_SPEECH_KEY is empty in .env");
  if (!text.trim()) throw new HttpError(400, "Nothing to say");
  if (!/^[a-z]{2}-[A-Z]{2}-[A-Za-z]+Neural$/.test(voice)) throw new HttpError(400, `Unexpected voice name ${voice}`);

  const dir = join(ROOT, ".cache", "tts");
  const file = join(dir, createHash("sha1").update(`${voice}|${rate}|${text}`).digest("hex") + ".mp3");
  try {
    return await readFile(file);
  } catch {
    // Not cached yet.
  }

  const lang = voice.split("-").slice(0, 2).join("-");
  const pct = Math.round((rate - 1) * 100);
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}">` +
    `<voice name="${voice}"><prosody rate="${pct >= 0 ? "+" : ""}${pct}%">${escapeXml(text)}</prosody></voice></speak>`;
  const res = await fetch(`https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": azureKey,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "interview-coach",
    },
    body: ssml,
  });
  if (!res.ok) throw new HttpError(502, `Azure text-to-speech failed (${res.status}). ${(await res.text().catch(() => "")).slice(0, 200)}`.trim());
  const audio = Buffer.from(await res.arrayBuffer());
  await mkdir(dir, { recursive: true });
  await writeFile(file, audio);
  return audio;
}

function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}
