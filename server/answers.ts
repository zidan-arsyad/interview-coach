// Your practice answers: for each question, the latest AI feedback (a tighter version and keywords),
// saved in profile/answers.json so the overlay can show them. Private, like the rest of profile/.
import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { HttpError } from "./http.ts";
import { PROFILE } from "./profile.ts";

export type SavedAnswer = { question: string; said: string; tighter: string; cues: string[]; rating: number; at: number };

const FILE = join(PROFILE, "answers.json");

export async function readAnswers(): Promise<Record<string, SavedAnswer>> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as Record<string, SavedAnswer>;
  } catch {
    return {};
  }
}

export async function saveAnswer(id: string, entry: Partial<SavedAnswer>): Promise<Record<string, SavedAnswer>> {
  if (!/^[a-z0-9][\w-]{0,79}$/i.test(id)) throw new HttpError(400, "Bad answer id");
  const all = await readAnswers();
  all[id] = {
    question: String(entry.question ?? "").slice(0, 500),
    said: String(entry.said ?? "").slice(0, 5000),
    tighter: String(entry.tighter ?? "").slice(0, 5000),
    cues: (entry.cues ?? []).map(String).slice(0, 8),
    rating: Number(entry.rating) || 0,
    at: Number(entry.at) || Date.now(),
  };
  const tmp = FILE + ".tmp";
  await writeFile(tmp, JSON.stringify(all, null, 2), "utf8");
  await rename(tmp, FILE);
  return all;
}
