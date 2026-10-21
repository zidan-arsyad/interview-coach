// my-details.md: "## [id] Title" headings, "> hint" lines, then the answer as free text.
import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PROFILE } from "./profile.ts";

export type DetailItem = { id: string; title: string; hint: string; answer: string };

const FILE = join(PROFILE, "my-details.md");
const HEADING = /^##\s*\[([a-z0-9-]+)\]\s*(.*)$/i;

type Section = { id: string; title: string; heading: string; hints: string[]; body: string[] };

function parse(text: string): { header: string[]; sections: Section[] } {
  const header: string[] = [];
  const sections: Section[] = [];
  for (const line of text.replace(/^﻿/, "").split(/\r?\n/)) {
    const m = HEADING.exec(line);
    if (m) {
      sections.push({ id: m[1].toLowerCase(), title: m[2].trim(), heading: line, hints: [], body: [] });
      continue;
    }
    const current = sections.at(-1);
    if (!current) header.push(line);
    else if (line.trimStart().startsWith(">") && current.body.every((l) => !l.trim())) current.hints.push(line);
    else current.body.push(line);
  }
  return { header, sections };
}

export async function readDetails(file = FILE): Promise<DetailItem[]> {
  const text = await readFile(file, "utf8").catch(() => "");
  return parse(text).sections.map((s) => ({
    id: s.id,
    title: s.title,
    hint: s.hints.map((h) => h.replace(/^\s*>\s?/, "")).join(" "),
    answer: s.body.join("\n").trim(),
  }));
}

export async function writeDetails(answers: Record<string, string>, file = FILE): Promise<DetailItem[]> {
  const { header, sections } = parse(await readFile(file, "utf8"));
  const out: string[] = [...trimEnd(header), ""];
  for (const s of sections) {
    const answer = (answers[s.id] ?? s.body.join("\n")).replace(/\r\n/g, "\n").trim();
    out.push(s.heading, ...s.hints, ...(answer ? [answer] : []), "", "");
  }
  const tmp = file + ".tmp";
  await writeFile(tmp, trimEnd(out).join("\n") + "\n", "utf8");
  await rename(tmp, file);
  return readDetails(file);
}

function trimEnd(lines: string[]): string[] {
  const copy = [...lines];
  while (copy.length && !copy.at(-1)!.trim()) copy.pop();
  return copy;
}
