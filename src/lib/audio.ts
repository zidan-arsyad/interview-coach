// Spoken lines: Azure neural voices through the server (cached) when an Azure key is set,
// otherwise the browser's own voices (Chrome: Google 國語（臺灣）; Edge: Microsoft HsiaoChen).
import { api } from "./api.ts";

export const VOICES = {
  zhFemale: "zh-TW-HsiaoChenNeural",
  zhMale: "zh-TW-YunJheNeural",
  enMale: "en-US-AndrewNeural",
  enFemale: "en-US-AvaNeural",
};

export const interviewerVoices = [
  { id: VOICES.enMale, label: "US English, male" },
  { id: VOICES.enFemale, label: "US English, female" },
  { id: VOICES.zhMale, label: "Taiwanese voice speaking English" },
];

let useAzure = true;
let current: HTMLAudioElement | null = null;
let speechRun = 0; // bumps on stop, so a queued browser utterance knows it was cancelled
const urls = new Map<string, Promise<string>>();

export function setAzureVoices(available: boolean): void {
  useAzure = available;
}

export function azureVoicesOn(): boolean {
  return useAzure;
}

function audioUrl(text: string, voice: string, rate: number): Promise<string> {
  const key = `${voice}|${rate}|${text}`;
  let url = urls.get(key);
  if (!url) {
    url = api.tts(text, voice, rate).then((blob) => URL.createObjectURL(blob));
    url.catch(() => urls.delete(key));
    urls.set(key, url);
  }
  return url;
}

export function preload(text: string, voice: string, rate = 1): void {
  if (useAzure) audioUrl(text, voice, rate).catch(() => {});
}

/** Plays a line and resolves when it finishes or is stopped. `voice` picks the language when using browser voices. */
export async function speak(text: string, voice: string, rate = 1): Promise<void> {
  stopSpeaking();
  if (!useAzure) return speakWithBrowser(text, voice.startsWith("zh") ? "zh-TW" : "en-US", rate);
  const audio = new Audio(await audioUrl(text, voice, rate));
  current = audio;
  await new Promise<void>((resolve, reject) => {
    audio.onended = () => resolve();
    audio.onpause = () => resolve();
    audio.onerror = () => reject(new Error("Couldn't play the audio"));
    audio.play().catch(reject);
  });
  if (current === audio) current = null;
}

export function stopSpeaking(): void {
  current?.pause();
  current = null;
  speechRun++;
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}

export function playUrl(url: string): Promise<void> {
  stopSpeaking();
  const audio = new Audio(url);
  current = audio;
  return new Promise((resolve) => {
    audio.onended = () => resolve();
    audio.onpause = () => resolve();
    audio.onerror = () => resolve();
    audio.play().catch(() => resolve());
  });
}

// ---------------------------------------------------------------- browser voices

let voiceList: Promise<SpeechSynthesisVoice[]> | null = null;

function voices(): Promise<SpeechSynthesisVoice[]> {
  if (!("speechSynthesis" in window)) return Promise.resolve([]);
  const now = speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  voiceList ??= new Promise((resolve) => {
    const done = () => resolve(speechSynthesis.getVoices());
    speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 2000);
  });
  return voiceList;
}

export type VoiceInfo = { voice: SpeechSynthesisVoice | null; quality: "taiwan" | "mainland" | "good" | "basic" | "none" };

/** The best installed voice: Taiwan Mandarin for Chinese (mainland Mandarin as a fallback, never Cantonese). */
export async function bestVoice(lang: "zh-TW" | "en-US"): Promise<VoiceInfo> {
  const ranked = (await voices())
    .map((v) => {
      const l = v.lang.replace("_", "-").toLowerCase();
      let score = -1;
      if (lang === "zh-TW") {
        if (l === "zh-tw" || l.startsWith("zh-hant-tw")) score = 100;
        else if (l === "zh-cn" || l.startsWith("zh-hans") || l === "zh") score = 40;
      } else if (l === "en-us") score = 100;
      else if (l.startsWith("en")) score = 60;
      if (score < 0) return null;
      if (/natural|online|neural/i.test(v.name)) score += 20;
      if (/google/i.test(v.name)) score += 15;
      return { v, score };
    })
    .filter((x): x is { v: SpeechSynthesisVoice; score: number } => x !== null)
    .sort((a, b) => b.score - a.score);
  const top = ranked[0];
  if (!top) return { voice: null, quality: "none" };
  if (lang === "zh-TW") return { voice: top.v, quality: top.score >= 100 ? "taiwan" : "mainland" };
  return { voice: top.v, quality: top.score >= 115 ? "good" : "basic" };
}

async function speakWithBrowser(text: string, lang: "zh-TW" | "en-US", rate: number): Promise<void> {
  if (!("speechSynthesis" in window)) return;
  const { voice } = await bestVoice(lang);
  const run = ++speechRun;
  // Chrome's online voices stop on long text, so speak sentence by sentence.
  const parts = text.match(/[^.!?。！？]+[.!?。！？]*\s*/g) ?? [text];
  for (const part of parts) {
    if (run !== speechRun) return;
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(part.trim());
      u.lang = lang;
      u.rate = rate;
      if (voice) u.voice = voice;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      speechSynthesis.speak(u);
    });
  }
}

export function googleTranslateUrl(zh: string): string {
  return `https://translate.google.com/?sl=zh-TW&tl=en&text=${encodeURIComponent(zh)}&op=translate`;
}
