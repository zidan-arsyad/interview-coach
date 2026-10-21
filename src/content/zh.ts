// Chinese lines come from the profile (profile/zh.ts).
import { zhSets } from "#profile/zh.ts";
import type { ZhSet } from "./types.ts";

export type { ZhLine, ZhSet } from "./types.ts";
export { zhSets };

export function zhSet(id: string): ZhSet {
  const set = zhSets.find((s) => s.id === id);
  if (!set) throw new Error(`Unknown Chinese set ${id}`);
  return set;
}
