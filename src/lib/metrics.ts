// Delivery numbers from a recognized English answer.
import { interview } from "../content/interview.ts";
import type { SpeechResult, WordResult } from "./speech.ts";
import { voiceActivity } from "./vad.ts";

export type Delivery = {
  words: number;
  wpm?: number;
  pauses: number; // gaps over 1.5 s between words
  longestPause: number;
  spelledOut: boolean; // spelled the profile's spellCheck word letter by letter (e.g. S-P-I-L)
  weakWords: WordResult[]; // low pronunciation accuracy
};

export const PACE = { slow: 105, fast: 145 }; // the panel asked for slow, clear, loud speech

/** Pauses come from the recording's loudness when it's given (works with every speech engine). */
export function delivery(result: SpeechResult, pcm?: Int16Array): Delivery {
  const lexical = result.lexical.toLowerCase();
  const words = lexical.split(/\s+/).filter(Boolean).length;
  let pauses = 0;
  let longestPause = 0;
  const vad = pcm ? voiceActivity(pcm) : null;
  if (vad) {
    pauses = vad.pauses;
    longestPause = vad.longestPause;
  } else {
    const spoken = result.words.filter((w) => w.errorType !== "Omission");
    for (let i = 1; i < spoken.length; i++) {
      const gap = spoken[i].offset - (spoken[i - 1].offset + spoken[i - 1].duration);
      if (gap > 1.5) pauses++;
      longestPause = Math.max(longestPause, gap);
    }
  }
  const span = result.speechSeconds || vad?.speechSeconds || 0;
  return {
    words,
    wpm: span > 5 && words ? Math.round(words / (span / 60)) : undefined,
    pauses,
    longestPause,
    // Spelled-out letters come back as single letters ("s p i l"); said as one word they don't.
    spelledOut: spelledOut(lexical),
    weakWords: result.words.filter((w) => w.accuracy !== undefined && w.accuracy < 60 && w.errorType !== "Insertion" && /[a-z]/i.test(w.word)),
  };
}

/** True when the profile's spellCheck word (e.g. SPIL) was said letter by letter. */
export function spelledOut(lexical: string): boolean {
  const letters = (interview.spellCheck?.word ?? "").toLowerCase().replace(/[^a-z]/g, "").split("");
  if (letters.length < 2) return false;
  return new RegExp(`\\b${letters.join("\\s+")}\\b`).test(lexical.toLowerCase().replace(/[^a-z\s]/g, " "));
}

export function spelledOutMessage(): string {
  const s = interview.spellCheck;
  return s ? `You spelled out ${s.word.split("").join("-")}. Say it as one word, like “${s.sayAs}”.` : "";
}

export function paceLabel(wpm?: number): { label: string; tone: "good" | "warn" | "bad" | "muted" } {
  if (wpm === undefined) return { label: "—", tone: "muted" };
  if (wpm < PACE.slow - 15) return { label: "very slow", tone: "warn" };
  if (wpm < PACE.slow) return { label: "a bit slow", tone: "good" };
  if (wpm <= PACE.fast) return { label: "good pace", tone: "good" };
  if (wpm <= PACE.fast + 20) return { label: "a bit fast", tone: "warn" };
  return { label: "too fast", tone: "bad" };
}

export function lengthLabel(seconds: number, target?: [number, number]): { label: string; tone: "good" | "warn" | "bad" | "muted" } {
  if (!target) return { label: "", tone: "muted" };
  const [min, max] = target;
  if (seconds < min * 0.6) return { label: "too short", tone: "bad" };
  if (seconds < min) return { label: "a bit short", tone: "warn" };
  if (seconds <= max) return { label: "right length", tone: "good" };
  if (seconds <= max * 1.25) return { label: "a bit long", tone: "warn" };
  return { label: "too long", tone: "bad" };
}

export function formatSeconds(s: number): string {
  const total = Math.max(0, Math.round(s));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
