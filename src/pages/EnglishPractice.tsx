import { useEffect, useMemo, useRef, useState } from "react";
import { cards, casePrompts, interview, messages, card as cardById, type Card } from "../content/interview.ts";
import { useApp } from "../state.tsx";
import { Mic } from "../lib/recorder.ts";
import { Take, pickEngine, type SpeechResult } from "../lib/speech.ts";
import { VOICES, playUrl, speak, stopSpeaking } from "../lib/audio.ts";
import { delivery, formatSeconds, lengthLabel, paceLabel, spelledOutMessage, type Delivery } from "../lib/metrics.ts";
import { api } from "../lib/api.ts";
import { feedbackPrompt, feedbackSchema, feedbackSystem, type AnswerFeedback } from "../lib/coach.ts";
import { load, save } from "../lib/store.ts";
import { Chip, Elapsed, Kbd, LevelMeter, Notice, RecordButton, Score, useHotkeys, type RecState } from "../components.tsx";

type Item = Card & { isCase?: boolean };
type Attempt = { seconds: number; url: string; result: SpeechResult | null; d?: Delivery; feedback?: AnswerFeedback; feedbackError?: string; at: number };

const GROUPS = ["Intro", "Core", "Pre-hire", "Common", "Tough", "Case", "Reference"];

function buildItems(): Item[] {
  const caseCard = cardById("case");
  const fromCards = cards.filter((c) => c.question && c.target && c.id !== "intro-zh" && c.id !== "case" && c.group !== "Phrases");
  const slides = { ...cardById("slides"), question: "Please go ahead with your presentation." };
  const universal: Item = { ...caseCard, id: "case-universal", title: "Any problem: the 6 C's answer", question: "Tell us how you would solve a problem on the line.", isCase: true };
  const cases: Item[] = casePrompts.map((p) => ({
    ...caseCard,
    id: `case-${p.id}`,
    title: p.prompt,
    question: p.prompt,
    cues: [...caseCard.cues.slice(0, 7), `Check first: ${p.checkFirst}`],
    full: p.model,
    isCase: true,
  }));
  cases.unshift(universal);
  return [...fromCards.slice(0, 1), slides, ...fromCards.slice(1), ...cases];
}

export function EnglishPractice() {
  const { status, details, detail } = useApp();
  const engine = pickEngine(status);
  const items = useMemo(buildItems, []);
  const [id, setId] = useState(() => load("en:item", "intro-en"));
  const item = items.find((i) => i.id === id) ?? items[0];
  const [showCues, setShowCues] = useState(() => load("en:cues", true));
  const [rec, setRec] = useState<RecState>("idle");
  const [partial, setPartial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, Attempt[]>>({});
  const [mic] = useState(() => new Mic());
  const take = useRef<Take | null>(null);
  const [startedAt, setStartedAt] = useState(0);

  useEffect(() => () => mic.close(), [mic]);
  useEffect(() => save("en:item", item.id), [item.id]);
  useEffect(() => save("en:cues", showCues), [showCues]);

  const attempts = history[item.id] ?? [];
  const latest = attempts[0];

  async function toggleRecord() {
    if (rec === "recording") return finish();
    if (rec !== "idle") return;
    setError(null);
    setPartial("");
    stopSpeaking();
    setRec("starting");
    try {
      await mic.open();
    } catch (e) {
      setError((e as Error).message);
      setRec("idle");
      return;
    }
    const t = new Take(mic, { engine, language: "en-US", assess: true, prosody: true, onPartial: setPartial });
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
    const d = result ? delivery(result, recording.pcm) : undefined;
    const attempt: Attempt = { seconds: recording.seconds, url: recording.url, result, d, at: Date.now() };
    const itemId = item.id;
    setHistory((h) => ({ ...h, [itemId]: [attempt, ...(h[itemId] ?? [])].slice(0, 5) }));
    setRec("idle");
    if (result?.text && status?.ai) void getFeedback(itemId, attempt);
  }

  async function getFeedback(itemId: string, attempt: Attempt) {
    const it = items.find((i) => i.id === itemId)!;
    const d = attempt.d;
    const stats = `${Math.round(attempt.seconds)} s${d?.wpm ? `, ${d.wpm} words per minute` : ""}, ${d?.pauses ?? 0} long pauses${d?.spelledOut ? `, spelled out ${interview.spellCheck?.word} letter by letter` : ""}`;
    const notes = (it.details ?? []).map((k) => detail(k)).filter(Boolean);
    const withNotes = notes.length ? { ...it, cues: [...it.cues, ...notes.map((n) => `My note: ${n}`)] } : it;
    try {
      const fb = await api.llm<AnswerFeedback>({
        system: feedbackSystem(details),
        messages: [{ role: "user", text: feedbackPrompt(withNotes, attempt.result?.text ?? "", stats) }],
        schema: feedbackSchema,
        temperature: 0.4,
      });
      update(itemId, attempt.at, { feedback: fb });
    } catch (e) {
      update(itemId, attempt.at, { feedbackError: (e as Error).message });
    }
  }

  function update(itemId: string, at: number, patch: Partial<Attempt>) {
    setHistory((h) => ({ ...h, [itemId]: (h[itemId] ?? []).map((a) => (a.at === at ? { ...a, ...patch } : a)) }));
  }

  useHotkeys((e) => {
    if (e.key === " ") {
      e.preventDefault();
      void toggleRecord();
    } else if (e.key === "q" || e.key === "Q") void speak(item.question ?? item.title, VOICES.enMale);
    else if (e.key === "c" || e.key === "C") setShowCues((v) => !v);
  });

  const myNotes = (item.details ?? []).map((k) => ({ id: k, text: detail(k), title: details.find((d) => d.id === k)?.title ?? k }));

  return (
    <div className="page">
      <header className="page-head">
        <h1>English practice</h1>
        <p className="lede">Answer out loud, then check length, pace and pronunciation, and get feedback on content. Point, reason, example; 30–60 seconds.</p>
      </header>
      {engine === "none" && (
        <Notice tone="bad">
          This browser has no speech recognition (Firefox doesn't), so there's no transcript: you can still record, time and replay yourself. Open{" "}
          <b>http://localhost:5179</b> in <b>Chrome</b>, or add a free <code>GROQ_API_KEY</code> to <code>.env</code>.
        </Notice>
      )}
      {engine !== "none" && !status?.ai && <Notice tone="info">Add a Gemini or Groq key to .env to get feedback on what you said. Timing, pace and pauses work already.</Notice>}

      <div className="drill-grid">
        <aside className="line-list card">
          {GROUPS.map((g) => {
            const inGroup = items.filter((i) => (i.isCase ? "Case" : i.group) === g);
            if (!inGroup.length) return null;
            return (
              <div key={g} className="group">
                <h4>{g}</h4>
                {inGroup.map((i) => (
                  <button key={i.id} className={`line-item${i.id === item.id ? " on" : ""}`} onClick={() => rec === "idle" && (setId(i.id), setPartial(""), setError(null))}>
                    <span>{i.isCase ? i.title.split(/(?<=\.)\s/)[0].replace(/\.$/, "") : i.title}</span>
                    {history[i.id]?.[0]?.feedback && <Chip tone="accent">{history[i.id][0].feedback!.rating}/5</Chip>}
                  </button>
                ))}
              </div>
            );
          })}
        </aside>

        <section className="card drill-main">
          <div className="q-head">
            <h2>{item.question ?? item.title}</h2>
            <div className="q-meta">
              <button className="btn" onClick={() => void speak(item.question ?? item.title, VOICES.enMale)} title="Q">
                ▶ Hear the question
              </button>
              {item.target && (
                <Chip>
                  Aim for {item.target[0]}–{item.target[1]} s
                </Chip>
              )}
              <label className="toggle">
                <input type="checkbox" checked={showCues} onChange={(e) => setShowCues(e.target.checked)} /> Show my cues
              </label>
            </div>
          </div>

          {showCues && (
            <div className="cues">
              <ul>
                {item.cues.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
              {myNotes.length > 0 && (
                <div className="my-notes">
                  {myNotes.map((n) =>
                    n.text ? (
                      <p key={n.id}>
                        <b>Your note:</b> {n.text}
                      </p>
                    ) : (
                      <p key={n.id} className="muted small">
                        Your note for “{n.title}” is empty. <a href="#/details">Fill it in</a>.
                      </p>
                    ),
                  )}
                </div>
              )}
            </div>
          )}

          <div className="controls">
            <RecordButton state={rec} onClick={() => void toggleRecord()} idleLabel="Record answer" />
            {rec === "recording" && <Elapsed since={startedAt} target={item.target} />}
            <LevelMeter mic={mic} active={rec === "recording"} />
          </div>
          <p className="small muted keys">
            <Kbd>Space</Kbd> record/stop · <Kbd>Q</Kbd> hear question · <Kbd>C</Kbd> cues on/off
          </p>
          {rec === "recording" && partial && <p className="live">{partial}</p>}
          {error && <Notice tone="bad">{error}</Notice>}

          {latest && <AttemptView attempt={latest} target={item.target} isCase={item.isCase} />}
          {attempts.length > 1 && (
            <div className="history">
              <h3>Earlier tries</h3>
              <ul>
                {attempts.slice(1).map((a) => (
                  <li key={a.at}>
                    {formatSeconds(a.seconds)} · {a.d?.wpm ?? "—"} wpm{a.feedback ? ` · ${a.feedback.rating}/5` : ""}{" "}
                    <button className="link" onClick={() => void playUrl(a.url)}>
                      play
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function AttemptView({ attempt, target, isCase }: { attempt: Attempt; target?: [number, number]; isCase?: boolean }) {
  const { result, d, feedback } = attempt;
  const len = lengthLabel(attempt.seconds, target);
  const pace = paceLabel(d?.wpm);
  return (
    <div className="results">
      <div className="score-row">
        <div className="score">
          <div className={`score-value tone-${len.tone}`}>{formatSeconds(attempt.seconds)}</div>
          <div className="score-label">{len.label || "Length"}</div>
        </div>
        <div className="score">
          <div className={`score-value tone-${pace.tone}`}>{d?.wpm ?? "—"}</div>
          <div className="score-label">wpm · {pace.label}</div>
        </div>
        <div className="score">
          <div className={`score-value tone-${(d?.pauses ?? 0) > 2 ? "warn" : "good"}`}>{d?.pauses ?? "—"}</div>
          <div className="score-label">long pauses</div>
        </div>
        <Score label="Pronunciation" value={result?.scores?.accuracy} />
        <Score label="Fluency" value={result?.scores?.fluency} />
        {result?.scores?.prosody !== undefined && <Score label="Intonation" value={result.scores.prosody} />}
      </div>
      {d?.spelledOut && <Notice tone="bad">{spelledOutMessage()}</Notice>}
      {d && d.weakWords.length > 0 && (
        <p className="small">
          Words to say more clearly:{" "}
          {d.weakWords.slice(0, 8).map((w, i) => (
            <Chip key={i} tone="warn" title={`score ${Math.round(w.accuracy ?? 0)}`}>
              {w.word}
            </Chip>
          ))}
        </p>
      )}
      <div className="transcript">
        <div className="transcript-head">
          <h3>What you said</h3>
          <button className="btn btn-sm" onClick={() => void playUrl(attempt.url)}>
            ▷ Play
          </button>
        </div>
        <p>{result?.text || <span className="muted">Nothing recognized.</span>}</p>
      </div>
      {result?.text && !feedback && !attempt.feedbackError && <p className="muted small">Getting feedback…</p>}
      {attempt.feedbackError && <Notice tone="bad">Feedback failed: {attempt.feedbackError}</Notice>}
      {feedback && <FeedbackView fb={feedback} isCase={isCase} />}
    </div>
  );
}

const MESSAGE_LABEL: Record<string, string> = {
  ...Object.fromEntries(messages.map((m) => [m.id, m.short])),
  none: "None of your three messages",
};

export function FeedbackView({ fb, isCase }: { fb: AnswerFeedback; isCase?: boolean }) {
  return (
    <div className="feedback">
      <div className="feedback-head">
        <span className="stars" aria-label={`${fb.rating} out of 5`}>
          {"★".repeat(fb.rating)}
          <span className="muted">{"★".repeat(Math.max(0, 5 - fb.rating))}</span>
        </span>
        <Chip tone={fb.message === "none" ? "warn" : "good"}>{MESSAGE_LABEL[fb.message] ?? fb.message}</Chip>
        {fb.star !== "n/a" && <Chip tone={fb.star === "full" ? "good" : "warn"}>STAR: {fb.star}</Chip>}
        <Chip tone={fb.length === "ok" ? "good" : "warn"}>length: {fb.length}</Chip>
      </div>
      <div className="fb-cols">
        {fb.good.length > 0 && (
          <div>
            <h4>Worked</h4>
            <ul>
              {fb.good.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </div>
        )}
        {fb.fix.length > 0 && (
          <div>
            <h4>Change next time</h4>
            <ul>
              {fb.fix.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {fb.missing.length > 0 && (
        <p className="small">
          <b>Left out:</b> {fb.missing.join(" · ")}
        </p>
      )}
      {isCase && (
        <p className="small">
          <b>Case steps covered:</b> {fb.caseStepsHit.length ? fb.caseStepsHit.join(" → ") : "none"}
        </p>
      )}
      {fb.tighter && (
        <div className="tighter">
          <div className="transcript-head">
            <h4>A tighter version, in your words</h4>
            <button className="btn btn-sm" onClick={() => void speak(fb.tighter.replace(/\[[^\]]*\]/g, ""), VOICES.enMale)}>
              ▶ Listen
            </button>
          </div>
          <p>{fb.tighter}</p>
        </div>
      )}
    </div>
  );
}
