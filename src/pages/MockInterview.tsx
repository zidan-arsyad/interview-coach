import { useEffect, useRef, useState } from "react";
import { cards, casePrompts, coaching, interview, likelyCards, messages } from "../content/interview.ts";
import { useApp } from "../state.tsx";
import { Mic } from "../lib/recorder.ts";
import { Take, pickEngine, type Engine } from "../lib/speech.ts";
import { VOICES, interviewerVoices, playUrl, speak, stopSpeaking } from "../lib/audio.ts";
import { delivery, formatSeconds } from "../lib/metrics.ts";
import { api, type LlmMessage } from "../lib/api.ts";
import {
  interviewerSchema,
  interviewerSystem,
  scorecardSchema,
  scorecardSystem,
  type InterviewerTurn,
  type MockOptions,
  type Scorecard,
  type TurnKind,
} from "../lib/coach.ts";
import { load, save } from "../lib/store.ts";
import { Chip, Elapsed, Kbd, LevelMeter, Notice, useHotkeys } from "../components.tsx";

type Phase = "setup" | "running" | "scoring" | "done";
type Step = "thinking" | "speaking" | "your-turn" | "listening" | "processing";

type InterviewerLine = { who: "interviewer"; text: string; lang: "en" | "zh"; kind: TurnKind; topic: string; at: number };
type CandidateLine = { who: "candidate"; text: string; seconds: number; wpm?: number; pauses: number; language?: string; at: number; url?: string };
type Line = InterviewerLine | CandidateLine;

type Settings = MockOptions & { voice: string; captions: boolean; autoListen: boolean };

const DEFAULTS: Settings = {
  style: "friendly",
  minutes: 15,
  chinese: true,
  slides: true,
  caseQuestion: true,
  voice: VOICES.enMale,
  captions: true,
  autoListen: true,
};

// Used when there's no AI key: a fixed run through the profile's most likely questions.
const SCRIPTED: Omit<InterviewerLine, "who" | "at">[] = (() => {
  const asked = likelyCards
    .map((id) => cards.find((c) => c.id === id))
    .filter((c): c is (typeof cards)[number] => Boolean(c?.question) && c!.group !== "Case")
    .slice(0, 6);
  const turns: Omit<InterviewerLine, "who" | "at">[] = [
    { text: "Good morning, and thank you for joining. Please introduce yourself.", lang: "en", kind: "greeting", topic: "intro-en" },
    ...asked.slice(0, 3).map((c) => ({ text: c.question!, lang: "en" as const, kind: "question" as const, topic: c.id })),
  ];
  if (coaching.chineseQuestions[0]) turns.push({ text: coaching.chineseQuestions[0], lang: "zh", kind: "chinese", topic: "other" });
  turns.push(...asked.slice(3).map((c) => ({ text: c.question!, lang: "en" as const, kind: "question" as const, topic: c.id })));
  if (casePrompts[0]) turns.push({ text: casePrompts[0].prompt, lang: "en", kind: "case", topic: "case" });
  turns.push(
    { text: "Do you have any questions for us?", lang: "en", kind: "their_questions", topic: "your-questions" },
    { text: "Thank you very much for your time today. We will let you know the result soon. Goodbye.", lang: "en", kind: "closing", topic: "other" },
  );
  return turns;
})();

export function MockInterview() {
  const { status, details } = useApp();
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULTS, ...load<Partial<Settings>>("mock:settings", {}) }));
  const [phase, setPhase] = useState<Phase>("setup");
  const [step, setStep] = useState<Step>("thinking");
  const [lines, setLines] = useState<Line[]>([]);
  const [partial, setPartial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [waitNote, setWaitNote] = useState<string | null>(null);
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [savedAs, setSavedAs] = useState<string | null>(null);
  const [answerStart, setAnswerStart] = useState(0);
  const [mic] = useState(() => new Mic());

  // Interview state that async steps read; `lines` mirrors it for rendering.
  const run = useRef({
    messages: [] as LlmMessage[],
    lines: [] as Line[],
    startedAt: 0,
    take: null as Take | null,
    scriptIndex: 0,
    lastTurn: null as InterviewerLine | null,
    pendingUserText: "",
    stopped: false,
  });
  const push = (line: Line) => {
    run.current.lines = [...run.current.lines, line];
    setLines(run.current.lines);
  };

  const scripted = !status?.ai;
  const engine = pickEngine(status);
  useEffect(() => save("mock:settings", settings), [settings]);
  useEffect(
    () => () => {
      run.current.stopped = true;
      run.current.take?.cancel();
      stopSpeaking();
      mic.close();
    },
    [mic],
  );

  const minutesIn = () => (performance.now() - run.current.startedAt) / 60000;

  async function start() {
    setError(null);
    setLines([]);
    setScorecard(null);
    setSavedAs(null);
    try {
      await mic.open();
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    Object.assign(run.current, { messages: [], lines: [], startedAt: performance.now(), take: null, scriptIndex: 0, lastTurn: null, stopped: false });
    setPhase("running");
    void interviewerTurn("[0.0 min elapsed] (The candidate has joined the Google Meet call.)");
  }

  async function interviewerTurn(userText: string) {
    const r = run.current;
    if (r.stopped) return;
    setStep("thinking");
    setError(null);
    r.pendingUserText = userText;
    let turn: Omit<InterviewerLine, "who" | "at">;
    if (scripted) {
      const next = SCRIPTED[Math.min(r.scriptIndex++, SCRIPTED.length - 1)];
      turn = next;
    } else {
      const messages: LlmMessage[] = [...r.messages, { role: "user", text: userText }];
      try {
        const t = await api.llm<InterviewerTurn>(
          { system: interviewerSystem(details, settings), messages, schema: interviewerSchema, temperature: 0.8, maxTokens: 2048 },
          (s) => setWaitNote(`Gemini's free tier is busy. Waiting ${s} s…`),
        );
        setWaitNote(null);
        r.messages = [...messages, { role: "model", text: JSON.stringify(t) }];
        turn = { text: t.say, lang: t.lang === "zh" ? "zh" : "en", kind: t.end ? "closing" : t.kind, topic: t.topic };
      } catch (e) {
        setWaitNote(null);
        setError(`The AI interviewer didn't answer: ${(e as Error).message}`);
        setStep("your-turn");
        return;
      }
    }
    if (r.stopped) return;
    const line: InterviewerLine = { who: "interviewer", ...turn, at: minutesIn() };
    r.lastTurn = line;
    push(line);
    await say(line);
    if (r.stopped) return;
    if (line.kind === "closing") return void finishInterview();
    if (settings.autoListen) void startAnswer();
    else setStep("your-turn");
  }

  async function say(line: InterviewerLine) {
    setStep("speaking");
    try {
      await speak(line.text, line.lang === "zh" ? VOICES.zhMale : settings.voice);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function startAnswer() {
    const r = run.current;
    if (r.take || r.stopped) return;
    stopSpeaking();
    setPartial("");
    // The browser's recognition can only listen for one language at a time, so it stays on English.
    const t = new Take(mic, { engine, language: "en-US", bilingual: settings.chinese && engine !== "browser", onPartial: setPartial });
    r.take = t;
    setAnswerStart(t.startedAt);
    setStep("listening");
  }

  async function doneAnswering() {
    const r = run.current;
    const t = r.take;
    if (!t) return;
    r.take = null;
    setStep("processing");
    const { recording, result, error: err } = await t.stop();
    if (err) setError(err);
    const d = result ? delivery(result, recording.pcm) : undefined;
    const line: CandidateLine = {
      who: "candidate",
      text: result?.text ?? "",
      seconds: recording.seconds,
      wpm: d?.wpm,
      pauses: d?.pauses ?? 0,
      language: result?.language,
      at: minutesIn(),
      url: recording.url,
    };
    push(line);
    const elapsed = minutesIn();
    let msg = `[${elapsed.toFixed(1)} min elapsed · answer ${Math.round(line.seconds)} s${line.wpm ? `, ${line.wpm} wpm` : ""}] ${line.text || "(no answer heard)"}`;
    if (elapsed > settings.minutes + 1.5) msg += "\n[Time is up: thank the candidate and close the interview now.]";
    void interviewerTurn(msg);
  }

  async function finishInterview() {
    const r = run.current;
    r.stopped = true;
    r.take?.cancel();
    r.take = null;
    stopSpeaking();
    setPhase("scoring");
    const transcript = transcriptText(r.lines);
    let card: Scorecard | null = null;
    if (!scripted) {
      try {
        card = await api.llm<Scorecard>(
          { system: scorecardSystem(details), messages: [{ role: "user", text: transcript }], schema: scorecardSchema, temperature: 0.4, maxTokens: 8192 },
          (s) => setWaitNote(`Gemini's free tier is busy. Waiting ${s} s…`),
        );
      } catch (e) {
        setError(`Couldn't build the scorecard: ${(e as Error).message}`);
      }
      setWaitNote(null);
    }
    setScorecard(card);
    setPhase("done");
    api
      .saveSession({ savedAt: new Date().toISOString(), settings, scripted, lines: r.lines.map((l) => ({ ...l, url: undefined })), scorecard: card })
      .then((s) => setSavedAs(s.file))
      .catch(() => {});
  }

  function endNow() {
    if (phase === "running") void finishInterview();
  }

  useHotkeys((e) => {
    if (phase !== "running") return;
    if (e.key === " ") {
      e.preventDefault();
      if (step === "listening") void doneAnswering();
      else if (step === "your-turn" || step === "speaking") void startAnswer();
    } else if ((e.key === "r" || e.key === "R") && run.current.lastTurn && step !== "listening") void say(run.current.lastTurn);
  });

  if (phase === "setup")
    return (
      <Setup
        settings={settings}
        setSettings={setSettings}
        onStart={() => void start()}
        scripted={scripted}
        azure={Boolean(status?.azure)}
        engine={engine}
        filled={status?.detailsFilled ?? 0}
        total={status?.detailsTotal ?? 0}
        error={error}
      />
    );

  const last = run.current.lastTurn;
  return (
    <div className="page mock">
      <header className="page-head row">
        <div>
          <h1>Mock interview</h1>
          <p className="lede">
            {phase === "running" ? (
              <>
                <Elapsed since={run.current.startedAt} target={[settings.minutes * 60 - 60, settings.minutes * 60]} /> of {settings.minutes}:00
              </>
            ) : phase === "scoring" ? (
              "Building your scorecard…"
            ) : (
              "Finished"
            )}
          </p>
        </div>
        {phase === "running" && (
          <button className="btn btn-danger" onClick={endNow}>
            End interview
          </button>
        )}
        {phase === "done" && (
          <button className="btn btn-primary" onClick={() => setPhase("setup")}>
            New mock interview
          </button>
        )}
      </header>
      {scripted && phase === "running" && <Notice tone="info">No Gemini key, so this is a fixed list of common questions without follow-ups or a scorecard.</Notice>}
      {waitNote && <Notice tone="info">{waitNote}</Notice>}
      {error && <Notice tone="bad">{error}</Notice>}

      {phase === "running" && (
        <section className="card stage">
          <div className={`bubble bubble-interviewer${step === "speaking" ? " talking" : ""}`}>
            <div className="who">Interviewer {step === "thinking" && <span className="dots">thinking</span>}</div>
            {last && (settings.captions || step !== "speaking") ? (
              <p lang={last.lang === "zh" ? "zh-TW" : "en"} className={last.lang === "zh" ? "zh-text" : ""}>
                {last.text}
              </p>
            ) : (
              <p className="muted">{step === "speaking" ? "Listen…" : "…"}</p>
            )}
            {last && step !== "listening" && step !== "thinking" && (
              <button className="btn btn-sm" onClick={() => void say(last)}>
                ↺ Repeat (R)
              </button>
            )}
          </div>

          <div className={`bubble bubble-you${step === "listening" ? " talking" : ""}`}>
            <div className="who">
              You {step === "listening" && <Elapsed since={answerStart} target={[30, 60]} />}
              <LevelMeter mic={mic} active={step === "listening"} />
            </div>
            {step === "listening" ? <p>{partial || <span className="muted">Speaking… press Space when you're done.</span>}</p> : step === "processing" ? <p className="muted">Got it…</p> : <p className="muted">Wait for the question.</p>}
          </div>

          <div className="controls">
            {step === "listening" ? (
              <button className="btn btn-primary btn-lg" onClick={() => void doneAnswering()}>
                Done answering <Kbd>Space</Kbd>
              </button>
            ) : step === "your-turn" || step === "speaking" ? (
              <button className="btn btn-primary btn-lg" onClick={() => void startAnswer()}>
                Start my answer <Kbd>Space</Kbd>
              </button>
            ) : null}
            {error && step === "your-turn" && run.current.pendingUserText && (
              <button className="btn" onClick={() => void interviewerTurn(run.current.pendingUserText)}>
                Try the interviewer again
              </button>
            )}
          </div>
        </section>
      )}

      {phase === "scoring" && <div className="card center muted">Reading the whole interview… this takes 10–30 seconds.</div>}
      {phase === "done" && scorecard && <ScorecardView card={scorecard} />}
      {phase === "done" && savedAs && <p className="small muted">Saved to sessions/{savedAs}</p>}

      {lines.length > 0 && <TranscriptView lines={lines} />}
    </div>
  );
}

function Setup(props: {
  settings: Settings;
  setSettings: (s: Settings) => void;
  onStart: () => void;
  scripted: boolean;
  azure: boolean;
  engine: Engine;
  filled: number;
  total: number;
  error: string | null;
}) {
  const { settings: s, setSettings } = props;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings({ ...s, [k]: v });
  return (
    <div className="page">
      <header className="page-head">
        <h1>Mock interview</h1>
        <p className="lede">
          An AI {interview.companyShort} interviewer runs your real {interview.minutes}-minute plan: introduction, slides, questions with follow-ups, a case, and “any
          questions for us?”. Answer out loud; you get a scorecard at the end.
        </p>
      </header>
      {props.engine === "none" && (
        <Notice tone="bad">
          This browser can't hear your answers (Firefox has no speech recognition). Open <b>http://localhost:5179</b> in <b>Chrome</b>, or add a free{" "}
          <code>GROQ_API_KEY</code> to <code>.env</code>.
        </Notice>
      )}
      {props.engine === "browser" && s.chinese && (
        <p className="small muted">The browser's recognition listens for English only, so a Chinese reply shows up garbled in the transcript. That's fine for practice.</p>
      )}
      {props.scripted && <Notice tone="info">No Gemini key yet: you'll get a fixed list of common questions instead of a live interviewer.</Notice>}
      {props.filled < props.total && (
        <Notice tone="info">
          {props.filled} of {props.total} personal details filled in. The interviewer asks sharper follow-ups when <a href="#/details">My details</a> is complete.
        </Notice>
      )}
      {props.error && <Notice tone="bad">{props.error}</Notice>}
      <section className="card form">
        {props.azure && (
          <label>
            Interviewer
            <select className="select" value={s.voice} onChange={(e) => set("voice", e.target.value)}>
              {interviewerVoices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Style
          <select className="select" value={s.style} onChange={(e) => set("style", e.target.value as Settings["style"])}>
            <option value="friendly">Friendly: follow-ups when needed</option>
            <option value="probing">Probing: asks for numbers, challenges vague answers</option>
          </select>
        </label>
        <label>
          Length
          <select className="select" value={s.minutes} onChange={(e) => set("minutes", Number(e.target.value))}>
            <option value={15}>15 minutes (the real slot)</option>
            <option value={8}>8 minutes (quick round)</option>
          </select>
        </label>
        <div className="checks">
          <label className="toggle">
            <input type="checkbox" checked={s.slides} onChange={(e) => set("slides", e.target.checked)} /> I'll present my slides (talk through them out loud)
          </label>
          <label className="toggle">
            <input type="checkbox" checked={s.caseQuestion} onChange={(e) => set("caseQuestion", e.target.checked)} /> Include a case question
          </label>
          <label className="toggle">
            <input type="checkbox" checked={s.chinese} onChange={(e) => set("chinese", e.target.checked)} /> Surprise me with one question in Chinese
          </label>
          <label className="toggle">
            <input type="checkbox" checked={s.captions} onChange={(e) => set("captions", e.target.checked)} /> Show the interviewer's words (like Meet captions)
          </label>
          <label className="toggle">
            <input type="checkbox" checked={s.autoListen} onChange={(e) => set("autoListen", e.target.checked)} /> Start listening as soon as the interviewer finishes
          </label>
        </div>
        <p className="small muted">Use headphones so the interviewer's voice doesn't get into your microphone. Press Space when you finish each answer.</p>
        <button className="btn btn-primary btn-lg" onClick={props.onStart} disabled={props.engine === "none"}>
          Start mock interview
        </button>
      </section>
      <PastSessions />
    </div>
  );
}

function PastSessions() {
  const [list, setList] = useState<{ file: string; savedAt: string; summary?: string; rating?: number }[]>([]);
  const [open, setOpen] = useState<{ file: string; scorecard: Scorecard | null; lines: Line[] } | null>(null);
  useEffect(() => {
    api.sessions().then(setList).catch(() => {});
  }, []);
  if (!list.length) return null;
  return (
    <section className="card">
      <h2>Earlier mock interviews</h2>
      <ul className="sessions">
        {list.slice(0, 8).map((s) => (
          <li key={s.file}>
            <button
              className="link"
              onClick={() =>
                api
                  .session(s.file)
                  .then((j) => setOpen({ file: s.file, ...(j as { scorecard: Scorecard | null; lines: Line[] }) }))
                  .catch(() => {})
              }
            >
              {s.savedAt ? new Date(s.savedAt).toLocaleString() : s.file}
            </button>
            {s.rating ? ` · ${s.rating}/5` : ""} {s.summary && <span className="muted small">{s.summary}</span>}
          </li>
        ))}
      </ul>
      {open && (
        <div>
          {open.scorecard ? <ScorecardView card={open.scorecard} /> : <p className="muted">No scorecard saved for this one.</p>}
          <TranscriptView lines={open.lines} />
        </div>
      )}
    </section>
  );
}

const MESSAGE_LABEL: Record<string, string> = { ...Object.fromEntries(messages.map((m) => [m.id, m.short])), none: "—" };

function ScorecardView({ card }: { card: Scorecard }) {
  return (
    <section className="card scorecard">
      <div className="sc-head">
        <div className="sc-rating">
          {card.overall.rating}
          <small>/5</small>
        </div>
        <p>{card.overall.summary}</p>
      </div>
      {card.topFixes.length > 0 && (
        <div className="sc-fixes">
          <h3>Fix these before the real interview</h3>
          <ol>
            {card.topFixes.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ol>
        </div>
      )}
      {card.redFlags.length > 0 && (
        <Notice tone="bad">
          <b>Watch out:</b> {card.redFlags.join(" · ")}
        </Notice>
      )}
      <div className="table-wrap">
        <table className="sc-table">
          <thead>
            <tr>
              <th>Question</th>
              <th>Rating</th>
              <th>Message</th>
              <th>STAR</th>
              <th>Length</th>
              <th>Next time</th>
            </tr>
          </thead>
          <tbody>
            {card.answers.map((a, i) => (
              <tr key={i}>
                <td>
                  {a.question}
                  {a.best && <div className="small muted">“{a.best}”</div>}
                </td>
                <td>{a.rating}/5</td>
                <td>{MESSAGE_LABEL[a.message] ?? a.message}</td>
                <td>{a.star}</td>
                <td>{a.length}</td>
                <td>
                  {a.fix}
                  {a.cues.length > 0 && (
                    <div className="cue-chips">
                      {a.cues.map((c, j) => (
                        <Chip key={j}>{c}</Chip>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sc-extra">
        {card.caseQuestion.asked && (
          <p>
            <b>Case:</b> covered {card.caseQuestion.stepsHit.join(" → ") || "no steps"}
            {card.caseQuestion.stepsMissed.length > 0 && <> · missed {card.caseQuestion.stepsMissed.join(", ")}</>}. {card.caseQuestion.comment}
          </p>
        )}
        {card.chinese.asked && (
          <p>
            <b>Chinese moment:</b> {card.chinese.handled ? "handled well" : "needs work"}. {card.chinese.comment}
          </p>
        )}
      </div>
    </section>
  );
}

function TranscriptView({ lines }: { lines: Line[] }) {
  return (
    <details className="card transcript-log" open={false}>
      <summary>Transcript ({lines.filter((l) => l.who === "candidate").length} answers)</summary>
      {lines.map((l, i) =>
        l.who === "interviewer" ? (
          <p key={i} className="t-int">
            <b>Interviewer:</b> <span lang={l.lang === "zh" ? "zh-TW" : "en"}>{l.text}</span>
          </p>
        ) : (
          <div key={i} className="t-you">
            <p>
              <b>You</b>{" "}
              <span className="small muted">
                {formatSeconds(l.seconds)}
                {l.wpm ? ` · ${l.wpm} wpm` : ""}
                {l.pauses ? ` · ${l.pauses} long pauses` : ""}
              </span>
              {l.url && (
                <button className="link" onClick={() => void playUrl(l.url!)}>
                  play
                </button>
              )}
            </p>
            <p>{l.text || <span className="muted">(nothing recognized)</span>}</p>
          </div>
        ),
      )}
    </details>
  );
}

function transcriptText(lines: Line[]): string {
  return lines
    .map((l) =>
      l.who === "interviewer"
        ? `Interviewer (${l.kind}${l.topic && l.topic !== "other" ? `, ${l.topic}` : ""}): ${l.text}`
        : `Candidate [${Math.round(l.seconds)} s${l.wpm ? `, ${l.wpm} wpm` : ""}${l.pauses ? `, ${l.pauses} long pauses` : ""}${l.language && l.language !== "en-US" ? `, spoke ${l.language}` : ""}]: ${l.text || "(nothing recognized)"}`,
    )
    .join("\n");
}
