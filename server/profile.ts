// The profile folder holds everything personal: interview content, Chinese lines, quick-fire decks,
// my-details.md and an optional sample.mp3. profile/ is git-ignored; profile.example/ is the shared
// template, copied to profile/ the first time the app runs.
import { copyFileSync, cpSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./env.ts";

export const PROFILE = join(ROOT, "profile");
export const PROFILE_EXAMPLE = join(ROOT, "profile.example");

/** Creates profile/ from the template if it doesn't exist yet. Returns true when it was created. */
export function ensureProfile(): boolean {
  if (existsSync(join(PROFILE, "interview.ts"))) return false;
  cpSync(PROFILE_EXAMPLE, PROFILE, { recursive: true, force: false, errorOnExist: false });
  console.log("\n  Created your private profile/ folder from profile.example/.");
  console.log("  Edit the files in profile/ to make the app yours (see README.md).\n");
  return true;
}

/** Creates .env (private, for API keys) from .env.example if it doesn't exist yet. */
export function ensureEnvFile(): boolean {
  const env = join(ROOT, ".env");
  const example = join(ROOT, ".env.example");
  if (existsSync(env) || !existsSync(example)) return false;
  copyFileSync(example, env);
  console.log("  Created .env for your API keys: open it with Notepad and paste them in (see README.md).\n");
  return true;
}
