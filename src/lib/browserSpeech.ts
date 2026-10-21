// The browser's own speech recognition (Chrome sends audio to Google's free service; Edge has its own).
// Firefox doesn't have it, so there the app uses Groq instead, if a key is set.

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function browserRecognitionAvailable(): boolean {
  return ctor() !== null;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "The browser blocked speech recognition. Allow the microphone for localhost and try again.",
  "service-not-allowed": "This browser doesn't allow its speech recognition here. Use Chrome, or add a free Groq key.",
  network: "The browser's speech recognition needs an internet connection.",
  "language-not-supported": "This browser can't recognize that language. Use Chrome, or add a free Groq key.",
  "audio-capture": "No microphone found for speech recognition.",
};

export class BrowserRecognizer {
  private rec: Recognition | null = null;
  private finals: string[] = [];
  private interim = "";
  private active = true;
  private ended: Promise<void>;
  private markEnded!: () => void;
  private joiner: string;
  error: string | null = null;

  constructor(lang: string, onPartial?: (text: string) => void) {
    const Ctor = ctor();
    if (!Ctor) throw new Error("This browser has no speech recognition. Use Chrome, or add a free Groq key to .env.");
    this.joiner = lang.startsWith("zh") ? "" : " ";
    this.ended = new Promise((resolve) => (this.markEnded = resolve));
    const begin = () => {
      const rec = new Ctor();
      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) this.finals.push(r[0].transcript.trim());
          else interim += r[0].transcript;
        }
        this.interim = interim.trim();
        onPartial?.(this.text());
      };
      rec.onerror = (e) => {
        if (e.error === "no-speech" || e.error === "aborted") return;
        this.error = ERRORS[e.error] ?? `Speech recognition error: ${e.error}`;
      };
      // Chrome ends a session after a pause or about a minute; keep going while we're recording.
      rec.onend = () => {
        if (this.active && !this.error) {
          try {
            begin();
            return;
          } catch {
            // fall through and finish
          }
        }
        this.markEnded();
      };
      rec.start();
      this.rec = rec;
    };
    begin();
  }

  text(): string {
    return [...this.finals, this.interim].filter(Boolean).join(this.joiner).trim();
  }

  async stop(): Promise<string> {
    this.active = false;
    try {
      this.rec?.stop();
    } catch {
      // already stopped
    }
    await Promise.race([this.ended, new Promise((r) => setTimeout(r, 4000))]);
    if (this.interim) {
      this.finals.push(this.interim);
      this.interim = "";
    }
    return this.text();
  }

  cancel(): void {
    this.active = false;
    try {
      this.rec?.abort();
    } catch {
      // already stopped
    }
  }
}
