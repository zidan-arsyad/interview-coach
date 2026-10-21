// Azure Speech in the browser: live recognition with pronunciation assessment, fed from our own
// microphone recorder so we also keep the audio for playback.
import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import { api } from "./api.ts";
import { wavBlob, type Mic, type Recording } from "./recorder.ts";
import { BrowserRecognizer, browserRecognitionAvailable } from "./browserSpeech.ts";
import { voiceActivity } from "./vad.ts";

export type WordResult = {
  word: string;
  offset: number; // seconds from the start of the take
  duration: number;
  accuracy?: number;
  errorType?: string; // None, Mispronunciation, Omission, Insertion, UnexpectedBreak, MissingBreak, Monotone
  syllables?: { syllable: string; grapheme?: string; accuracy?: number }[];
  phonemes?: { phoneme: string; accuracy?: number }[];
};

export type Scores = { overall: number; accuracy: number; fluency: number; completeness?: number; prosody?: number };

export type SpeechResult = {
  text: string;
  lexical: string;
  words: WordResult[];
  scores?: Scores;
  speechSeconds: number; // first word start → last word end
  segments: number;
  language?: string;
};

export type SessionOptions = {
  language: "zh-TW" | "en-US";
  referenceText?: string; // scripted assessment (Chinese lines)
  assess?: boolean; // pronunciation assessment on/off
  prosody?: boolean;
  autoDetect?: string[]; // e.g. ["en-US", "zh-TW"]; recognition only, no assessment
  onPartial?: (text: string) => void;
};

const TICKS = 1e7; // Azure offsets are in 100 ns ticks

export class SpeechSession {
  private push: sdk.PushAudioInputStream;
  private recognizer: sdk.SpeechRecognizer;
  private segments: AzureSegment[] = [];
  private languages: string[] = [];
  private committed = "";
  private error: string | null = null;
  private closed = false;
  private done: Promise<void>;
  private markDone!: () => void;

  static async start(opts: SessionOptions): Promise<SpeechSession> {
    const { token, region } = await api.speechToken();
    const session = new SpeechSession(opts, token, region);
    await new Promise<void>((resolve, reject) => session.recognizer.startContinuousRecognitionAsync(resolve, (e) => reject(new Error(e))));
    return session;
  }

  private constructor(opts: SessionOptions, token: string, region: string) {
    const config = sdk.SpeechConfig.fromAuthorizationToken(token, region);
    config.outputFormat = sdk.OutputFormat.Detailed;
    config.requestWordLevelTimestamps();
    this.push = sdk.AudioInputStream.createPushStream(sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1));
    const audio = sdk.AudioConfig.fromStreamInput(this.push);

    if (opts.autoDetect?.length) {
      config.setProperty(sdk.PropertyId.SpeechServiceConnection_LanguageIdMode, "Continuous");
      this.recognizer = sdk.SpeechRecognizer.FromConfig(config, sdk.AutoDetectSourceLanguageConfig.fromLanguages(opts.autoDetect), audio);
    } else {
      config.speechRecognitionLanguage = opts.language;
      this.recognizer = new sdk.SpeechRecognizer(config, audio);
      if (opts.assess) {
        const pa = new sdk.PronunciationAssessmentConfig(
          opts.referenceText ?? "",
          sdk.PronunciationAssessmentGradingSystem.HundredMark,
          sdk.PronunciationAssessmentGranularity.Phoneme,
          Boolean(opts.referenceText),
        );
        if (opts.prosody) pa.enableProsodyAssessment = true;
        pa.applyTo(this.recognizer);
      }
    }

    this.done = new Promise((resolve) => (this.markDone = resolve));
    this.recognizer.recognizing = (_s, e) => opts.onPartial?.(`${this.committed} ${e.result.text}`.trim());
    this.recognizer.recognized = (_s, e) => {
      if (e.result.reason !== sdk.ResultReason.RecognizedSpeech) return;
      try {
        this.segments.push(JSON.parse(e.result.properties.getProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult)) as AzureSegment);
      } catch {
        // A segment without JSON details still counts for the transcript below.
      }
      if (opts.autoDetect?.length) {
        const lang = sdk.AutoDetectSourceLanguageResult.fromResult(e.result).language;
        if (lang) this.languages.push(lang);
      }
      this.committed = `${this.committed} ${e.result.text}`.trim();
      opts.onPartial?.(this.committed);
    };
    this.recognizer.canceled = (_s, e) => {
      if (e.reason === sdk.CancellationReason.Error) this.error = friendlyError(e.errorCode, e.errorDetails);
      this.markDone();
    };
    this.recognizer.sessionStopped = () => this.markDone();
  }

  write(chunk: Int16Array): void {
    if (!this.closed) this.push.write(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer);
  }

  async finish(timeoutMs = 25_000): Promise<SpeechResult> {
    if (!this.closed) {
      this.closed = true;
      this.push.close();
    }
    await Promise.race([this.done, new Promise((r) => setTimeout(r, timeoutMs))]);
    await new Promise<void>((resolve) => this.recognizer.stopContinuousRecognitionAsync(resolve, () => resolve()));
    this.recognizer.close();
    if (this.error && !this.segments.length) throw new Error(this.error);
    return aggregate(this.segments, this.languages);
  }

  cancel(): void {
    if (!this.closed) {
      this.closed = true;
      this.push.close();
    }
    this.recognizer.stopContinuousRecognitionAsync(
      () => this.recognizer.close(),
      () => this.recognizer.close(),
    );
  }
}

/**
 * Which speech service hears you: Azure (with pronunciation scores) if its key is set, otherwise
 * Groq's Whisper (any browser) if its key is set, otherwise the browser's own recognition (Chrome).
 */
export type Engine = "azure" | "groq" | "browser" | "none";

export function pickEngine(status: { azure: boolean; groq: boolean } | null): Engine {
  if (status?.azure) return "azure";
  if (status?.groq) return "groq";
  if (browserRecognitionAvailable()) return "browser";
  return "none";
}

export const engineLabel: Record<Engine, string> = {
  azure: "Azure Speech (with pronunciation scores)",
  groq: "Groq Whisper",
  browser: "the browser's built-in speech recognition",
  none: "none",
};

export type TakeOptions = {
  engine: Engine;
  language: "zh-TW" | "en-US";
  referenceText?: string; // Azure scripted assessment
  assess?: boolean; // Azure pronunciation assessment
  prosody?: boolean;
  bilingual?: boolean; // the answer may be in English or Chinese
  onPartial?: (text: string) => void;
};

/**
 * One recorded answer. The microphone starts at once; the speech service connects in parallel
 * (Azure, browser) or gets the recording afterwards (Groq), so the first words aren't lost.
 */
export class Take {
  private pending: Int16Array[] = [];
  private session: SpeechSession | null = null;
  private ready: Promise<SpeechSession | null> = Promise.resolve(null);
  private browser: BrowserRecognizer | null = null;
  private unsubscribe: () => void;
  private error: string | null = null;
  private mic: Mic;
  private opts: TakeOptions;
  readonly startedAt = performance.now();

  constructor(mic: Mic, opts: TakeOptions) {
    this.mic = mic;
    this.opts = opts;
    this.unsubscribe = mic.subscribe((chunk) => {
      if (this.session) this.session.write(chunk);
      else if (opts.engine === "azure") this.pending.push(chunk);
    });
    mic.start();
    if (opts.engine === "azure") {
      this.ready = SpeechSession.start({
        language: opts.language,
        referenceText: opts.referenceText,
        assess: opts.assess,
        prosody: opts.prosody,
        autoDetect: opts.bilingual ? ["en-US", "zh-TW"] : undefined,
        onPartial: opts.onPartial,
      }).then(
        (s) => {
          for (const c of this.pending) s.write(c);
          this.pending = [];
          this.session = s;
          return s;
        },
        (err: Error) => {
          this.error = friendlyError(undefined, err.message);
          return null;
        },
      );
    } else if (opts.engine === "browser") {
      try {
        this.browser = new BrowserRecognizer(opts.language, opts.onPartial);
      } catch (err) {
        this.error = (err as Error).message;
      }
    } else if (opts.engine === "groq") {
      opts.onPartial?.("");
    }
  }

  async stop(): Promise<{ recording: Recording; result: SpeechResult | null; error: string | null }> {
    const recording = await this.mic.stop();
    this.unsubscribe();
    let result: SpeechResult | null = null;
    try {
      if (this.opts.engine === "azure") {
        const session = await this.ready;
        if (session) result = await session.finish();
      } else if (this.opts.engine === "browser" && this.browser) {
        const text = await this.browser.stop();
        if (this.browser.error) this.error = this.browser.error;
        result = { text, lexical: text.toLowerCase(), words: [], speechSeconds: voiceActivity(recording.pcm).speechSeconds, segments: text ? 1 : 0 };
      } else if (this.opts.engine === "groq") {
        result = await transcribeWithGroq(recording, this.opts);
      }
    } catch (err) {
      this.error = (err as Error).message;
    }
    return { recording, result, error: this.error };
  }

  cancel(): void {
    this.unsubscribe();
    void this.mic.stop(0);
    this.browser?.cancel();
    void this.ready.then((s) => s?.cancel());
  }
}

async function transcribeWithGroq(recording: Recording, opts: TakeOptions): Promise<SpeechResult> {
  const vad = voiceActivity(recording.pcm);
  // Whisper invents words for silence ("Thank you."), so don't send a silent take.
  if (!vad.voiced) return { text: "", lexical: "", words: [], speechSeconds: 0, segments: 0 };
  const lang = opts.bilingual ? "auto" : opts.language.startsWith("zh") ? "zh" : "en";
  const t = await api.transcribe(wavBlob(recording.pcm), lang);
  const words: WordResult[] = (t.words ?? []).map((w) => ({ word: w.word.trim(), offset: w.start, duration: Math.max(0, w.end - w.start) }));
  const last = words.at(-1);
  const named = (t.language ?? "").toLowerCase(); // Groq says "English" / "Chinese"
  const language = named === "chinese" || named === "zh" ? "zh-TW" : named === "english" || named === "en" ? "en-US" : t.language;
  return {
    text: t.text.trim(),
    lexical: t.text.toLowerCase(),
    words,
    speechSeconds: words.length && last ? last.offset + last.duration - words[0].offset : vad.speechSeconds,
    segments: t.segments?.length ?? 1,
    language,
  };
}

/** Runs a whole PCM buffer through a session (self-test with synthetic speech). */
export async function recognizePcm(pcm: Int16Array, opts: SessionOptions): Promise<SpeechResult> {
  const session = await SpeechSession.start(opts);
  const step = 3200; // 100 ms
  for (let i = 0; i < pcm.length; i += step) session.write(pcm.subarray(i, i + step));
  return session.finish(60_000);
}

type AzureWord = {
  Word: string;
  Offset?: number;
  Duration?: number;
  PronunciationAssessment?: { AccuracyScore?: number; ErrorType?: string };
  Syllables?: { Syllable: string; Grapheme?: string; PronunciationAssessment?: { AccuracyScore?: number } }[];
  Phonemes?: { Phoneme: string; PronunciationAssessment?: { AccuracyScore?: number } }[];
};
type AzureSegment = {
  DisplayText?: string;
  Duration?: number;
  NBest?: {
    Lexical?: string;
    Display?: string;
    PronunciationAssessment?: { AccuracyScore?: number; FluencyScore?: number; CompletenessScore?: number; PronScore?: number; ProsodyScore?: number };
    Words?: AzureWord[];
  }[];
};

function aggregate(segments: AzureSegment[], languages: string[]): SpeechResult {
  const words: WordResult[] = [];
  const texts: string[] = [];
  const lexical: string[] = [];
  let weight = 0;
  let fluency = 0;
  let completeness = 0;
  let pron = 0;
  let prosody = 0;
  let prosodyWeight = 0;

  for (const seg of segments) {
    const best = seg.NBest?.[0];
    if (!best) continue;
    texts.push(seg.DisplayText ?? best.Display ?? "");
    lexical.push(best.Lexical ?? "");
    const pa = best.PronunciationAssessment;
    const d = Math.max((seg.Duration ?? 0) / TICKS, 0.1);
    if (pa) {
      weight += d;
      fluency += (pa.FluencyScore ?? 0) * d;
      completeness += (pa.CompletenessScore ?? 0) * d;
      pron += (pa.PronScore ?? 0) * d;
      if (typeof pa.ProsodyScore === "number") {
        prosody += pa.ProsodyScore * d;
        prosodyWeight += d;
      }
    }
    for (const w of best.Words ?? []) words.push(mapWord(w));
  }

  const spoken = words.filter((w) => w.errorType !== "Omission");
  const first = spoken[0];
  const last = spoken.at(-1);
  const speechSeconds = first && last ? last.offset + last.duration - first.offset : 0;

  let scores: Scores | undefined;
  if (weight > 0) {
    const scored = words.filter((w) => w.accuracy !== undefined && w.errorType !== "Omission" && w.errorType !== "Insertion");
    const accuracy = scored.length ? scored.reduce((n, w) => n + w.accuracy!, 0) / scored.length : 0;
    const s: Scores = {
      accuracy,
      fluency: fluency / weight,
      completeness: completeness / weight,
      prosody: prosodyWeight ? prosody / prosodyWeight : undefined,
      overall: 0,
    };
    s.overall = segments.length === 1 ? pron / weight : combine(s);
    scores = s;
  }

  return {
    text: texts.join(" ").trim(),
    lexical: lexical.join(" ").trim(),
    words,
    scores,
    speechSeconds,
    segments: segments.length,
    language: mostCommon(languages),
  };
}

/** Azure's own weighting for multi-sentence takes: the weakest score counts double. */
export function combine(s: Scores): number {
  const parts = [s.accuracy, s.fluency, s.completeness ?? 100, ...(s.prosody !== undefined ? [s.prosody] : [])].sort((a, b) => a - b);
  if (parts.length === 4) return parts[0] * 0.4 + parts[1] * 0.2 + parts[2] * 0.2 + parts[3] * 0.2;
  return parts[0] * 0.6 + parts[1] * 0.2 + parts[2] * 0.2;
}

function mapWord(w: AzureWord): WordResult {
  const pa = w.PronunciationAssessment ?? {};
  return {
    word: w.Word,
    offset: (w.Offset ?? 0) / TICKS,
    duration: (w.Duration ?? 0) / TICKS,
    accuracy: typeof pa.AccuracyScore === "number" ? pa.AccuracyScore : undefined,
    errorType: pa.ErrorType,
    syllables: w.Syllables?.map((s) => ({ syllable: s.Syllable, grapheme: s.Grapheme, accuracy: s.PronunciationAssessment?.AccuracyScore })),
    phonemes: w.Phonemes?.map((p) => ({ phoneme: p.Phoneme, accuracy: p.PronunciationAssessment?.AccuracyScore })),
  };
}

function mostCommon(values: string[]): string | undefined {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function friendlyError(code: sdk.CancellationErrorCode | undefined, details: string): string {
  if (code === sdk.CancellationErrorCode.AuthenticationFailure || /401|unauthori/i.test(details)) return "Azure rejected the speech token. Check AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in .env.";
  if (code === sdk.CancellationErrorCode.TooManyRequests || /quota|429/i.test(details)) return "Azure's free speech quota is used up for now (5 audio hours a month on F0).";
  if (code === sdk.CancellationErrorCode.ConnectionFailure || /websocket|connection/i.test(details)) return "Couldn't connect to Azure Speech. Check your internet connection.";
  if (/AZURE_SPEECH_KEY/.test(details)) return details;
  return `Speech recognition failed: ${details}`;
}
