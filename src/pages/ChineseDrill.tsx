import { useEffect, useMemo, useRef, useState } from "react";
import { zhSets, type ZhLine as Line, type ZhSet } from "../content/zh.ts";
import { useApp } from "../state.tsx";
import { Mic } from "../lib/recorder.ts";
import { Take, combine, pickEngine, type Engine, type SpeechResult } from "../lib/speech.ts";
import { VOICES, bestVoice, googleTranslateUrl, playUrl, preload, speak, stopSpeaking, type VoiceInfo } from "../lib/audio.ts";
import { completeness, scoreLine, type CharScore } from "../lib/zhScore.ts";
import { compareZh } from "../lib/zhCompare.ts";
import { toneHelp, toneOf, tokenize } from "../lib/pinyin.ts";
import { load, save } from "../lib/store.ts";
import { Chip, Elapsed, Kbd, LevelMeter, Notice, RecordButton, Score, ZhLine, scoreTone, useHotkeys, type RecState } from "../components.tsx";

type Attempt = {
  engine: Engine;
  result: SpeechResult | null;
  chars: CharScore[];
  overall?: number;
  completeness?: number;
  toneSlips?: number;
  url: string;
  seconds: number;
};

const SLOW = 0.75;

export function ChineseDrill() {
  const { status } = useApp();
  const engine = pickEngine(status);
  const [setId, setSetId] = useState(() => load("zh:set", zhSets[0]?.id ?? ""));
  const set = zhSets.find((s) => s.id === setId) ?? zhSets[0];
  const [index, setIndex] = useState(0);
  const [full, setFull] = useState(false);
  const [voice, setVoice] = useState(() => load("zh:voice", VOICES.zhFemale));
  const [browserVoice, setBrowserVoice] = useState<VoiceInfo | null>(null);
  const [rec, setRec] = useState<RecState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<Record<string, Attempt>>({});
  const [best, setBest] = useState<Record<string, number>>(() => load("zh:best", {}));
  const [mic] = useState(() => new Mic());
  const take = useRef<Take | null>(null);
  const [startedAt, setStartedAt] = useState(0);

  useEffect(() => () => mic.close(), [mic]);
  useEffect(() => save("zh:set", set.id), [set.id]);
  useEffect(() => save("zh:voice", voice), [voice]);
  useEffect(() => {
    if (status && !status.azure) void bestVoice("zh-TW").then(setBrowserVoice);
  }, [status]);

  const line = set.lines[Math.min(index, set.lines.length - 1)];
  const fullText = useMemo(() => joinSet(set), [set]);
  const key = full ? `${set.id}:full` : line.id;
  const attempt = attempts[key];
  const text = full ? fullText.zh : line.zh;

  useEffect(() => {
    preload(text, voice);
  }, [text, voice]);

  const listen = (rate = 1) => {
    setError(null);
    speak(text, voice, rate).catch((e: Error) => setError(e.message));
  };

  async function toggleRecord() {
    if (rec === "recording") return finish();
    if (rec !== "idle") return;
    setError(null);
    stopSpeaking();
    setRec("starting");
    try {
      await mic.open();
    } catch (e) {
      setError((e as Error).message);
      setRec("idle");
      return;
    }
    const t = new Take(mic, { engine, language: "zh-TW", referenceText: text, assess: true });
    take.current = t;
    setStartedAt(t.startedAt);
    setRec("recording");
  }

  async function finish() {
    const t = take.current;
    if (!t) return;
    take.current = null;
    setRec("processing");
    const { recording, result, error: err } = await t.stop();
    if (err) setError(err);
    const zh = full ? fullText.zh : line.zh;
    const py = full ? fullText.py : line.py;
    let a: Attempt = { engine, result, chars: [], url: recording.url, seconds: recording.seconds };
    if (result && engine === "azure") {
      const chars = scoreLine(zh, py, result.words, result.segments <= 1);
      let overall = result.scores?.overall;
      let comp = result.scores?.completeness;
      if (result.scores && result.segments > 1) {
        comp = completeness(chars);
        overall = combine({ ...result.scores, completeness: comp });
      }
      a = { ...a, chars, overall, completeness: comp };
      if (!result.words.length) setError("Didn't catch any Chinese. Speak a little louder and closer to the mic, then try again.");
    } else if (result) {
      const check = compareZh(zh, py, result.text);
      a = { ...a, chars: check.chars, overall: check.understood, toneSlips: check.toneSlips };
      if (!check.heardAny) setError("Didn't catch any Chinese. Speak a little louder and closer to the mic, then try again.");
    }
    setAttempts((all) => ({ ...all, [key]: a }));
    if (a.overall !== undefined) {
      const score = Math.round(a.overall);
      setBest((b) => {
        const next = { ...b, [key]: Math.max(b[key] ?? 0, score) };
        save("zh:best", next);
        return next;
      });
    }
    setRec("idle");
  }

  const go = (delta: number) => {
    if (rec !== "idle") return;
    setFull(false);
    setIndex((i) => Math.max(0, Math.min(set.lines.length - 1, i + delta)));
  };

  useHotkeys((e) => {
    if (e.key === " ") {
      e.preventDefault();
      void toggleRecord();
    } else if (e.key === "l" || e.key === "L") listen(1);
    else if (e.key === "s" || e.key === "S") listen(SLOW);
    else if (e.key === "p" || e.key === "P") attempt && void playUrl(attempt.url);
    else if (e.key === "ArrowRight") go(1);
    else if (e.key === "ArrowLeft") go(-1);
  });

  const compare = async () => {
    if (!attempt) return;
    await speak(text, voice);
    await playUrl(attempt.url);
  };

  const target: [number, number] | undefined = full && set.fullRunSeconds ? [set.fullRunSeconds - 10, set.fullRunSeconds + 8] : undefined;

  return (
    <div className="page">
      <header className="page-head">
        <h1>Chinese drill</h1>
        <p className="lede">Listen, say it, see which syllables came through. Taiwan readings. Aim for every line at 80+, then do a full run.</p>
      </header>

      {engine === "none" && (
        <Notice tone="bad">
          This browser has no speech recognition (Firefox doesn't), so you can record and replay but not get checked. Open <b>http://localhost:5179</b> in{" "}
          <b>Chrome</b> (free, nothing to set up), or add a free <code>GROQ_API_KEY</code> to <code>.env</code> to use Firefox.
        </Notice>
      )}
      {engine !== "none" && engine !== "azure" && (
        <Notice tone="info">
          Checked with {engine === "groq" ? "Groq Whisper" : "the browser's speech recognition"}: green = heard as written, amber = right sound but another tone, red =
          heard as a different sound. Recognition fills in what it expects, so it's a bit lenient: also compare your take with the model voice.
        </Notice>
      )}
      {browserVoice && browserVoice.quality !== "taiwan" && (
        <Notice tone="warn">
          {browserVoice.quality === "none" ? "This browser has no Chinese voice." : `This browser only has a mainland Chinese voice (${browserVoice.voice?.name}).`} For the
          Taiwan pronunciation, use Chrome or Edge, or the “Google Translate” button on each line.
        </Notice>
      )}

      <div className="tabs" role="tablist">
        {zhSets.map((s) => (
          <button
            key={s.id}
            role="tab"
            className={`tab${s.id === set.id ? " on" : ""}`}
            onClick={() => {
              if (rec !== "idle") return;
              setSetId(s.id);
              setIndex(0);
              setFull(false);
            }}
          >
            {s.title}
          </button>
        ))}
      </div>

      <div className="drill-grid">
        <aside className="line-list card">
          {set.note && <p className="small muted">{set.note}</p>}
          {set.lines.map((l, i) => (
            <button key={l.id} className={`line-item${!full && i === index ? " on" : ""}`} onClick={() => rec === "idle" && (setFull(false), setIndex(i))}>
              <span className="line-zh" lang="zh-TW">
                {l.zh}
              </span>
              <Chip tone={scoreTone(best[l.id])}>{best[l.id] ?? "—"}</Chip>
            </button>
          ))}
          {set.fullRunSeconds && (
            <button className={`line-item line-full${full ? " on" : ""}`} onClick={() => rec === "idle" && setFull(true)}>
              <span>Full run · about {set.fullRunSeconds} s</span>
              <Chip tone={scoreTone(best[`${set.id}:full`])}>{best[`${set.id}:full`] ?? "—"}</Chip>
            </button>
          )}
        </aside>

        <section className="card drill-main">
          {full ? <FullRun set={set} attempt={attempt} /> : <OneLine line={line} attempt={attempt} />}

          <div className="controls">
            <button className="btn" onClick={() => listen(1)} title="L">
              ▶ Listen
            </button>
            <button className="btn" onClick={() => listen(SLOW)} title="S">
              Slow
            </button>
            <RecordButton state={rec} onClick={() => void toggleRecord()} />
            {rec === "recording" && <Elapsed since={startedAt} target={target} />}
            <LevelMeter mic={mic} active={rec === "recording"} />
            {attempt && (
              <>
                <button className="btn" onClick={() => void playUrl(attempt.url)} title="P">
                  ▷ My take
                </button>
                <button className="btn" onClick={() => void compare()}>
                  Model, then me
                </button>
              </>
            )}
            <a className="btn" href={googleTranslateUrl(text)} target="_blank" rel="noreferrer">
              Google Translate ↗
            </a>
            {status?.azure ? (
              <select className="select" value={voice} onChange={(e) => setVoice(e.target.value)} aria-label="Voice">
                <option value={VOICES.zhFemale}>Female voice</option>
                <option value={VOICES.zhMale}>Male voice</option>
              </select>
            ) : (
              browserVoice?.voice && <span className="small muted">Voice: {browserVoice.voice.name}</span>
            )}
          </div>
          <p className="small muted keys">
            <Kbd>Space</Kbd> record/stop · <Kbd>L</Kbd> listen · <Kbd>S</Kbd> slow · <Kbd>P</Kbd> my take · <Kbd>←</Kbd>
            <Kbd>→</Kbd> lines
          </p>
          {error && <Notice tone="bad">{error}</Notice>}
          {attempt && <AttemptView attempt={attempt} full={full} target={target} />}
        </section>
      </div>
    </div>
  );
}

function OneLine({ line, attempt }: { line: Line; attempt?: Attempt }) {
  return (
    <div className="line-view">
      <ZhLine zh={line.zh} py={line.py} scores={attempt?.chars.length ? attempt.chars : undefined} />
      <p className="line-en">{line.en}</p>
      {line.tip && <p className="tip">💡 {line.tip}</p>}
    </div>
  );
}

function FullRun({ set, attempt }: { set: ZhSet; attempt?: Attempt }) {
  // Split the whole-run scores back into lines.
  const perLine: (CharScore[] | undefined)[] = [];
  let at = 0;
  for (const l of set.lines) {
    const n = tokenize(l.zh, l.py).length;
    perLine.push(attempt?.chars.length ? attempt.chars.slice(at, at + n) : undefined);
    at += n;
  }
  return (
    <div className="line-view">
      <p className="small muted">Say the whole introduction in one go. Glance at the lines only if you get stuck.</p>
      {set.lines.map((l, i) => (
        <ZhLine key={l.id} zh={l.zh} py={l.py} scores={perLine[i]} size="md" />
      ))}
    </div>
  );
}

function describe(c: CharScore): string {
  const want = `${toneHelp[toneOf(c.token.py)]}`;
  if (c.issue === "missed" || c.status === "missed") return "not heard: say every syllable clearly";
  if (c.issue === "tone") return `heard ${c.heard} ${c.heardPy}: right sound, but ${toneHelp[toneOf(c.heardPy ?? "")].split(":")[0]} instead of the ${want}`;
  if (c.issue === "sound") return `heard ${c.heard} ${c.heardPy}: a different sound. Listen slowly and copy it`;
  return `${want} (score ${Math.round(c.accuracy ?? 0)})`;
}

function AttemptView({ attempt, full, target }: { attempt: Attempt; full: boolean; target?: [number, number] }) {
  const { result, chars, seconds, engine } = attempt;
  if (!result) return <p className="muted">Recorded {seconds.toFixed(1)} s. Play it back and compare with the model.</p>;
  const s = result.scores;
  const toFix = chars.filter((c) => c.token.kind === "han" && (c.status === "bad" || c.status === "missed" || (engine !== "azure" && c.status === "ok")));
  const shaky = engine === "azure" ? chars.filter((c) => c.token.kind === "han" && c.status === "ok") : [];
  return (
    <div className="results">
      <div className="score-row">
        {engine === "azure" ? (
          <>
            <Score big label="Overall" value={attempt.overall} />
            <Score label="Accuracy" value={s?.accuracy} />
            <Score label="Fluency" value={s?.fluency} />
            <Score label="Complete" value={attempt.completeness} />
            {s?.prosody !== undefined && <Score label="Prosody" value={s.prosody} />}
          </>
        ) : (
          <>
            <Score big label="Understood" value={attempt.overall} />
            <div className="score">
              <div className={`score-value tone-${attempt.toneSlips ? "warn" : "good"}`}>{attempt.toneSlips ?? 0}</div>
              <div className="score-label">tone slips</div>
            </div>
          </>
        )}
        {full && target && (
          <div className="score">
            <div className={`score-value tone-${seconds <= target[1] ? "good" : "warn"}`}>{Math.round(seconds)} s</div>
            <div className="score-label">Time</div>
          </div>
        )}
      </div>
      <p className="legend small">
        <span className="st-good">green</span> good · <span className="st-ok">amber</span> {engine === "azure" ? "close" : "tone"} · <span className="st-bad">red</span> fix ·{" "}
        <span className="st-missed">grey</span> missed. Hover a character for details.
      </p>
      {toFix.length > 0 ? (
        <div className="fix-list">
          <h3>Fix these first</h3>
          <ul>
            {toFix.slice(0, 8).map((c) => (
              <li key={c.token.index}>
                <span className="zh-inline" lang="zh-TW">
                  {c.token.text}
                </span>{" "}
                <b>{c.token.py}</b> · {describe(c)}
              </li>
            ))}
          </ul>
        </div>
      ) : shaky.length > 0 ? (
        <p className="small">
          Nearly there. Polish:{" "}
          {shaky.map((c) => (
            <span key={c.token.index} className="zh-inline" lang="zh-TW">
              {c.token.text}
              <small> {c.token.py}</small>{" "}
            </span>
          ))}
        </p>
      ) : (
        <p className="good-text">Everything came through. Now say it a little more naturally, like talking to a person.</p>
      )}
      <p className="small muted">Heard: {result.text || "—"}</p>
    </div>
  );
}

function joinSet(set: ZhSet): { zh: string; py: string } {
  return { zh: set.lines.map((l) => l.zh).join(""), py: set.lines.map((l) => l.py).join(" ") };
}
