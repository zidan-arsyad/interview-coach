// Mock interviews are saved as JSON in sessions/, so you can reread the transcript and scorecard later.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ROOT } from "./env.ts";
import { HttpError } from "./http.ts";

const DIR = join(ROOT, "sessions");

export async function saveSession(data: unknown): Promise<{ file: string }> {
  await mkdir(DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = `mock-${stamp}.json`;
  await writeFile(join(DIR, file), JSON.stringify(data, null, 2), "utf8");
  return { file };
}

export async function listSessions(): Promise<{ file: string; savedAt: string; summary?: string; rating?: number }[]> {
  const files = (await readdir(DIR).catch(() => [] as string[])).filter((f) => f.endsWith(".json")).sort().reverse();
  const out = [];
  for (const file of files.slice(0, 30)) {
    try {
      const json = JSON.parse(await readFile(join(DIR, file), "utf8"));
      out.push({ file, savedAt: json.savedAt ?? "", summary: json.scorecard?.overall?.summary, rating: json.scorecard?.overall?.rating });
    } catch {
      out.push({ file, savedAt: "" });
    }
  }
  return out;
}

export async function readSession(file: string): Promise<unknown> {
  if (!/^mock-[\w-]+\.json$/.test(file)) throw new HttpError(400, "Bad session name");
  return JSON.parse(await readFile(join(DIR, file), "utf8"));
}
