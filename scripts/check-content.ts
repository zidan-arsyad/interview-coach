// Checks a profile: every Chinese line's pinyin lines up with its characters, and card references
// (segments, Chinese sets, my-details ids) all exist.
// Usage: node scripts/check-content.ts [profile | profile.example]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Card, Segment, ZhSet } from "../src/content/types.ts";
import { checkAlignment } from "../src/lib/pinyin.ts";

const dir = join(import.meta.dirname, "..", process.argv[2] ?? "profile");
const load = (file: string) => import(pathToFileURL(join(dir, file)).href);
const { zhSets } = (await load("zh.ts")) as { zhSets: ZhSet[] };
const { cards, segments, likelyCards } = (await load("interview.ts")) as { cards: Card[]; segments: Segment[]; likelyCards: string[] };

let problems = 0;
const fail = (msg: string) => {
  problems++;
  console.error("✗ " + msg);
};

for (const set of zhSets) {
  for (const line of set.lines) {
    const issue = checkAlignment(line.zh, line.py);
    if (issue) fail(`${line.id} ${line.zh}: ${issue}`);
  }
}

const cardIds = new Set(cards.map((c) => c.id));
if (cardIds.size !== cards.length) fail("duplicate card ids");
for (const s of segments) if (s.card !== "home" && !cardIds.has(s.card)) fail(`segment ${s.id} points to missing card ${s.card}`);
for (const id of likelyCards) if (!cardIds.has(id)) fail(`likelyCards has missing card ${id}`);

const setIds = new Set(zhSets.map((s) => s.id));
const detailIds = new Set(Array.from(readFileSync(join(dir, "my-details.md"), "utf8").matchAll(/^##\s*\[([a-z0-9-]+)\]/gim)).map((m) => m[1]));
for (const c of cards) {
  if (c.zhSet && !setIds.has(c.zhSet)) fail(`card ${c.id} uses missing Chinese set ${c.zhSet}`);
  for (const d of c.details ?? []) if (!detailIds.has(d)) fail(`card ${c.id} uses missing detail ${d}`);
}

const lines = zhSets.reduce((n, s) => n + s.lines.length, 0);
console.log(`${process.argv[2] ?? "profile"}: ${problems ? `${problems} problem(s)` : `OK: ${lines} Chinese lines, ${cards.length} cards, ${detailIds.size} detail prompts`}`);
process.exit(problems ? 1 : 0);
