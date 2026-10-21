// The interview content comes from the profile folder (profile/interview.ts, private and git-ignored).
// This module re-exports it with a few lookup helpers, so the app never names a person or company.
import { cards } from "#profile/interview.ts";
import type { Card } from "./types.ts";

export type * from "./types.ts";
export * from "#profile/interview.ts";

export function card(id: string): Card {
  const c = cards.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown card ${id}`);
  return c;
}
