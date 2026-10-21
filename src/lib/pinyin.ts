// Pairs each Chinese character with its pinyin syllable, and reads tones from tone marks.

export type ZhToken = { text: string; py: string; kind: "han" | "latin" | "punct"; index: number };

const HAN = /\p{Script=Han}/u;
const LATIN = /[A-Za-z0-9]/;

export function tokenize(zh: string, py: string): ZhToken[] {
  const syllables = py.trim().split(/\s+/).filter(Boolean);
  const chars = Array.from(zh);
  const out: ZhToken[] = [];
  let k = 0;
  for (let i = 0; i < chars.length; ) {
    const ch = chars[i];
    if (HAN.test(ch)) {
      out.push({ text: ch, py: syllables[k++] ?? "", kind: "han", index: out.length });
      i++;
    } else if (LATIN.test(ch)) {
      let j = i;
      while (j < chars.length && LATIN.test(chars[j])) j++;
      const word = chars.slice(i, j).join("");
      if (syllables[k]?.toLowerCase() === word.toLowerCase()) k++;
      out.push({ text: word, py: "", kind: "latin", index: out.length });
      i = j;
    } else if (/\s/.test(ch)) {
      i++;
    } else {
      out.push({ text: ch, py: "", kind: "punct", index: out.length });
      i++;
    }
  }
  return out;
}

const PUNCT: Record<string, string> = { "，": ",", "。": ".", "！": "!", "？": "?", "、": ",", "：": ":", "；": ";" };

/** Pinyin to read aloud: the line's punctuation copied in (so you see where to pause), sentences capitalized. */
export function readablePinyin(zh: string, py: string): string {
  const words: string[] = [];
  for (const t of tokenize(zh, py)) {
    if (t.kind === "punct") {
      if (PUNCT[t.text] && words.length) words[words.length - 1] += PUNCT[t.text];
      continue;
    }
    let word = t.kind === "han" ? t.py : t.text;
    const prev = words.at(-1);
    if (!prev || /[.!?]$/.test(prev)) word = word.charAt(0).toUpperCase() + word.slice(1);
    words.push(word);
  }
  return words.join(" ");
}

/** Returns a problem description when the pinyin doesn't line up with the characters. */
export function checkAlignment(zh: string, py: string): string | null {
  const syllables = py.trim().split(/\s+/).filter(Boolean);
  const chars = Array.from(zh);
  const expected: string[] = [];
  for (let i = 0; i < chars.length; ) {
    if (HAN.test(chars[i])) {
      expected.push("·");
      i++;
    } else if (LATIN.test(chars[i])) {
      let j = i;
      while (j < chars.length && LATIN.test(chars[j])) j++;
      expected.push(chars.slice(i, j).join(""));
      i = j;
    } else i++;
  }
  if (expected.length !== syllables.length) return `${expected.length} characters/words but ${syllables.length} pinyin syllables`;
  for (let i = 0; i < expected.length; i++) {
    const isLatinWord = expected[i] !== "·";
    if (isLatinWord && expected[i].toLowerCase() !== syllables[i].toLowerCase()) return `pinyin "${syllables[i]}" should be "${expected[i]}"`;
    if (!isLatinWord && !/^[a-zü]+$/i.test(stripTone(syllables[i]))) return `"${syllables[i]}" doesn't look like pinyin`;
  }
  return null;
}

const MARKS: Record<string, [string, number]> = {
  ā: ["a", 1], á: ["a", 2], ǎ: ["a", 3], à: ["a", 4],
  ē: ["e", 1], é: ["e", 2], ě: ["e", 3], è: ["e", 4],
  ī: ["i", 1], í: ["i", 2], ǐ: ["i", 3], ì: ["i", 4],
  ō: ["o", 1], ó: ["o", 2], ǒ: ["o", 3], ò: ["o", 4],
  ū: ["u", 1], ú: ["u", 2], ǔ: ["u", 3], ù: ["u", 4],
  ǖ: ["ü", 1], ǘ: ["ü", 2], ǚ: ["ü", 3], ǜ: ["ü", 4],
};

export function toneOf(syllable: string): number {
  for (const ch of syllable) if (MARKS[ch]) return MARKS[ch][1];
  return 0;
}

export function stripTone(syllable: string): string {
  return Array.from(syllable)
    .map((ch) => MARKS[ch]?.[0] ?? ch)
    .join("");
}

export const toneHelp: Record<number, string> = {
  1: "1st tone: high and flat",
  2: "2nd tone: rising, like a question",
  3: "3rd tone: low, dipping",
  4: "4th tone: short and falling",
  0: "light tone: short and soft",
};
