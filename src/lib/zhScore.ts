// Lines up Azure's word scores with each character of a Chinese line, for colouring and tone tips.
import type { WordResult } from "./speech.ts";
import { tokenize, type ZhToken } from "./pinyin.ts";

export type CharStatus = "good" | "ok" | "bad" | "missed" | "neutral";
export type CharScore = {
  token: ZhToken;
  status: CharStatus;
  accuracy?: number;
  // Filled in when comparing against speech recognition (no scoring service).
  heard?: string;
  heardPy?: string;
  issue?: "tone" | "sound" | "missed";
};

const HAN = /\p{Script=Han}/u;

type Unit = { text: string; han: boolean; accuracy?: number; omitted: boolean };

export function statusOf(accuracy: number | undefined): CharStatus {
  if (accuracy === undefined) return "neutral";
  if (accuracy >= 85) return "good";
  if (accuracy >= 65) return "ok";
  return "bad";
}

export function scoreLine(zh: string, py: string, words: WordResult[], singleSegment: boolean): CharScore[] {
  const tokens = tokenize(zh, py);
  const units: Unit[] = [];
  for (const w of words) {
    if (w.errorType === "Insertion") continue;
    // In multi-sentence takes Azure's omission marks can be unreliable, so we judge omissions ourselves.
    if (w.errorType === "Omission" && !singleSegment) continue;
    const omitted = w.errorType === "Omission";
    const chars = Array.from(w.word);
    if (chars.some((c) => HAN.test(c))) {
      chars.forEach((c, i) => {
        if (!HAN.test(c)) return;
        const syl = w.syllables && w.syllables.length === chars.length ? w.syllables[i]?.accuracy : undefined;
        units.push({ text: c, han: true, accuracy: omitted ? 0 : (syl ?? w.accuracy), omitted });
      });
    } else {
      units.push({ text: w.word, han: false, accuracy: w.accuracy, omitted });
    }
  }

  let u = 0;
  return tokens.map((token) => {
    if (token.kind === "punct") return { token, status: "neutral" };
    const window = token.kind === "han" ? 4 : 3;
    for (let j = u; j < Math.min(units.length, u + window); j++) {
      const unit = units[j];
      const match = token.kind === "han" ? unit.han && unit.text === token.text : !unit.han && unit.text.toLowerCase().replace(/[^a-z0-9]/g, "") === token.text.toLowerCase();
      if (match) {
        u = j + 1;
        if (unit.omitted) return { token, status: "missed", accuracy: 0 };
        // English words inside a Chinese line are shown but never marked down.
        return { token, status: token.kind === "latin" ? "neutral" : statusOf(unit.accuracy), accuracy: unit.accuracy };
      }
    }
    return { token, status: token.kind === "latin" ? "neutral" : "missed" };
  });
}

export function completeness(scores: CharScore[]): number {
  const han = scores.filter((s) => s.token.kind === "han");
  if (!han.length) return 100;
  return (100 * han.filter((s) => s.status !== "missed").length) / han.length;
}
