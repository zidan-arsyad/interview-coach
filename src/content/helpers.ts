// Small helpers profiles can use while building their content.

/** The first sentence, cut to `max` characters. */
export function shorten(text: string, max = 90): string {
  const first = text.split(/(?<=[.?!])\s/)[0];
  return first.length > max ? first.slice(0, max - 3) + "…" : first;
}
