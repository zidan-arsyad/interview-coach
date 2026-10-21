// Microphone capture as 16 kHz mono 16-bit PCM, the format Azure Speech wants.

export type Recording = { pcm: Int16Array; seconds: number; url: string };
type ChunkListener = (chunk: Int16Array) => void;

const RATE = 16000;

export class Mic {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private chunks: Int16Array[] = [];
  private listeners = new Set<ChunkListener>();
  private recording = false;
  onLevel: ((level: number) => void) | null = null;

  get isOpen() {
    return this.ctx !== null;
  }

  async open(): Promise<void> {
    if (this.ctx) {
      await this.ctx.resume();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser can't use the microphone. Open the app in Chrome at http://localhost:5179.");
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      const name = (err as DOMException).name;
      if (name === "NotAllowedError") throw new Error("Microphone access is blocked. Click the camera/mic icon in Chrome's address bar and allow the microphone.");
      if (name === "NotFoundError") throw new Error("No microphone found. Plug in your headset and try again.");
      throw err;
    }
    // Device rate; the worklet downsamples to 16 kHz (Firefox can't resample a mic stream itself).
    const ctx = new AudioContext();
    await ctx.audioWorklet.addModule("/pcm-worklet.js");
    const source = ctx.createMediaStreamSource(this.stream);
    const node = new AudioWorkletNode(ctx, "pcm-capture");
    const mute = ctx.createGain();
    mute.gain.value = 0;
    source.connect(node).connect(mute).connect(ctx.destination); // keeps the worklet running
    node.port.onmessage = (e: MessageEvent<Float32Array>) => this.onBlock(e.data);
    this.ctx = ctx;
    this.node = node;
  }

  /** Called with each new block while recording; returns an unsubscribe function. */
  subscribe(listener: ChunkListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(): void {
    this.chunks = [];
    this.recording = true;
  }

  /** Keeps recording a moment longer so the last syllable isn't cut off. */
  async stop(tailMs = 350): Promise<Recording> {
    if (tailMs) await new Promise((r) => setTimeout(r, tailMs));
    this.recording = false;
    const pcm = concat(this.chunks);
    this.chunks = [];
    return { pcm, seconds: pcm.length / RATE, url: URL.createObjectURL(wavBlob(pcm)) };
  }

  close(): void {
    this.recording = false;
    this.node?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.ctx = null;
    this.node = null;
    this.stream = null;
  }

  private onBlock(block: Float32Array) {
    const pcm = new Int16Array(block.length);
    let sum = 0;
    for (let i = 0; i < block.length; i++) {
      const s = Math.max(-1, Math.min(1, block[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      sum += s * s;
    }
    this.onLevel?.(Math.min(1, Math.sqrt(sum / block.length) * 4));
    if (!this.recording) return;
    this.chunks.push(pcm);
    for (const fn of this.listeners) fn(pcm);
  }
}

export function concat(chunks: Int16Array[]): Int16Array {
  const out = new Int16Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

export function wavBlob(pcm: Int16Array, rate = RATE): Blob {
  const header = new DataView(new ArrayBuffer(44));
  const text = (at: number, s: string) => [...s].forEach((ch, i) => header.setUint8(at + i, ch.charCodeAt(0)));
  text(0, "RIFF");
  header.setUint32(4, 36 + pcm.byteLength, true);
  text(8, "WAVE");
  text(12, "fmt ");
  header.setUint32(16, 16, true);
  header.setUint16(20, 1, true);
  header.setUint16(22, 1, true);
  header.setUint32(24, rate, true);
  header.setUint32(28, rate * 2, true);
  header.setUint16(32, 2, true);
  header.setUint16(34, 16, true);
  text(36, "data");
  header.setUint32(40, pcm.byteLength, true);
  return new Blob([header.buffer, pcm.buffer as ArrayBuffer], { type: "audio/wav" });
}

/** Decodes an audio file (e.g. a TTS MP3) into 16 kHz PCM. Used by the self-test. */
export async function decodeToPcm(data: ArrayBuffer): Promise<Int16Array> {
  const decoded = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(data);
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * RATE), RATE);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  const f32 = rendered.getChannelData(0);
  const pcm = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm;
}
