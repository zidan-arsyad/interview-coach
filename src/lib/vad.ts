// Finds speech vs silence in a recording from its loudness, so pace and pauses work with any
// speech engine (the browser's recognition gives no word timings).

export type Vad = { voiced: boolean; start: number; end: number; speechSeconds: number; pauses: number; longestPause: number };

const FRAME_S = 0.03;

export function voiceActivity(pcm: Int16Array, rate = 16000, pauseSeconds = 1.5): Vad {
  const frame = Math.round(rate * FRAME_S);
  const n = Math.floor(pcm.length / frame);
  const none: Vad = { voiced: false, start: 0, end: 0, speechSeconds: 0, pauses: 0, longestPause: 0 };
  if (n < 5) return none;

  const rms = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = i * frame; j < (i + 1) * frame; j++) {
      const v = pcm[j] / 32768;
      sum += v * v;
    }
    rms[i] = Math.sqrt(sum / frame);
  }
  const sorted = Array.from(rms).sort((a, b) => a - b);
  const noise = sorted[Math.floor(n * 0.1)];
  const loud = sorted[Math.floor(n * 0.95)];
  if (loud < 0.008) return none; // effectively silent
  const threshold = Math.max(noise * 2.5, noise + (loud - noise) * 0.12, 0.004);

  // Voiced frames, ignoring blips shorter than ~90 ms.
  const voiced = Array.from(rms, (r) => r > threshold);
  const runs: [number, number][] = [];
  for (let i = 0; i < n; ) {
    if (!voiced[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < n && voiced[j]) j++;
    if (j - i >= 3) runs.push([i, j]);
    i = j;
  }
  if (!runs.length) return none;

  let pauses = 0;
  let longestPause = 0;
  for (let k = 1; k < runs.length; k++) {
    const gap = (runs[k][0] - runs[k - 1][1]) * FRAME_S;
    if (gap >= pauseSeconds) pauses++;
    longestPause = Math.max(longestPause, gap);
  }
  const start = runs[0][0] * FRAME_S;
  const end = runs.at(-1)![1] * FRAME_S;
  return { voiced: true, start, end, speechSeconds: end - start, pauses, longestPause };
}
