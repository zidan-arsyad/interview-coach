// Without a pronunciation-scoring service: compare what speech recognition heard with the script.
// Characters are matched by sound (pinyin), so a homophone counts as right, and a character heard
// with the same syllable but another tone is flagged as a tone slip.
import { pinyin } from "pinyin-pro";
import { stripTone, tokenize, toneOf, type ZhToken } from "./pinyin.ts";
import type { CharScore } from "./zhScore.ts";

const HAN = /\p{Script=Han}/u;

export type ZhCheck = { chars: CharScore[]; understood: number; toneSlips: number; heardAny: boolean };

type Heard = { char: string; py: string };

function syllable(py: string): string {
  return stripTone(py.toLowerCase()).replace(/v/g, "ü");
}

function sameSound(a: string, b: string): boolean {
  if (syllable(a) !== syllable(b)) return false;
  const ta = toneOf(a);
  const tb = toneOf(b);
  return ta === tb || ta === 0 || tb === 0; // a light (neutral) tone matches any tone
}

export function compareZh(zh: string, py: string, heardText: string): ZhCheck {
  const tokens = tokenize(zh, py);
  const ref = tokens.filter((t) => t.kind === "han");
  const heardChars = Array.from(heardText).filter((c) => HAN.test(c));
  const heardPy = heardChars.length ? (pinyin(heardChars.join(""), { type: "array", toneType: "symbol" }) as string[]) : [];
  const heard: Heard[] = heardChars.map((char, i) => ({ char, py: heardPy[i] ?? "" }));

  // Edit-distance alignment of script characters against heard characters.
  const cost = (r: ZhToken, h: Heard) => (r.text === h.char || sameSound(r.py, h.py) ? 0 : syllable(r.py) === syllable(h.py) ? 0.4 : 1);
  const R = ref.length;
  const H = heard.length;
  const d: number[][] = Array.from({ length: R + 1 }, (_, i) => Array.from({ length: H + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= R; i++) {
    for (let j = 1; j <= H; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost(ref[i - 1], heard[j - 1]));
    }
  }
  const byRef = new Map<number, CharScore>();
  let i = R;
  let j = H;
  while (i > 0) {
    const r = ref[i - 1];
    if (j > 0 && d[i][j] === d[i - 1][j - 1] + cost(r, heard[j - 1])) {
      const h = heard[j - 1];
      const c = cost(r, h);
      byRef.set(r.index, {
        token: r,
        status: c === 0 ? "good" : c < 1 ? "ok" : "bad",
        accuracy: c === 0 ? 100 : c < 1 ? 60 : 20,
        heard: h.char,
        heardPy: h.py,
        issue: c === 0 ? undefined : c < 1 ? "tone" : "sound",
      });
      i--;
      j--;
    } else if (j > 0 && d[i][j] === d[i][j - 1] + 1) {
      j--; // an extra heard character
    } else {
      byRef.set(r.index, { token: r, status: "missed", accuracy: 0, issue: "missed" });
      i--;
    }
  }

  const chars: CharScore[] = tokens.map((t) => byRef.get(t.index) ?? { token: t, status: "neutral" });
  const good = chars.filter((c) => c.status === "good").length;
  const toneSlips = chars.filter((c) => c.issue === "tone").length;
  return { chars, understood: R ? (100 * (good + 0.5 * toneSlips)) / R : 0, toneSlips, heardAny: H > 0 };
}
