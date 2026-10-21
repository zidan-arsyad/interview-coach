import { useState } from "react";
import { interview, messages, pitch } from "../content/interview.ts";
import { useApp } from "../state.tsx";
import { countdown, getSlot, slotStart, timeThem, timeYou, zones } from "../lib/time.ts";
import { Chip, Notice, useInterval } from "../components.tsx";
import { SelfTest } from "../SelfTest.tsx";
import { pickEngine } from "../lib/speech.ts";

const TILES = [
  { href: "#/chinese", title: "Chinese drill", text: "Your Chinese introduction, line by line, with a Taiwan voice and tone checks." },
  { href: "#/english", title: "English practice", text: "Intro, slides, every likely question and the case prompts, timed, with AI feedback." },
  { href: "#/case", title: "Case questions", text: "The 6 C's method, one answer that fits almost any problem, and worked examples." },
  { href: "#/mock", title: "Mock interview", text: `A spoken interview with an AI ${interview.companyShort} interviewer, then a scorecard.` },
  { href: "#/quick", title: "Quick-fire", text: "Company facts, industry numbers, the process toolkit, vocabulary." },
  { href: "#/details", title: "My details", text: "Your real numbers and stories, for sharper mock questions and overlay cues." },
  { href: "#/interview", title: "Interview day", text: `The always-on-top cue overlay for ${interview.platform}, plus the checklist.` },
];

export function Home() {
  const { status, serverDown } = useApp();
  const engine = pickEngine(status);
  const [now, setNow] = useState(() => new Date());
  useInterval(() => setNow(new Date()), 1000);
  const slot = getSlot();
  const start = slotStart(slot);
  const ms = start.getTime() - now.getTime();

  return (
    <div className="page">
      <header className="hero card">
        <div>
          <p className="eyebrow">
            {interview.company.split(" (")[0]} · {interview.role.split(" (")[0]} · {interview.platform}
          </p>
          <h1>{ms > 0 ? `Interview in ${countdown(ms)}` : ms > -slot.minutes * 60000 ? "Interview in progress" : "Interview done. Well done!"}</h1>
          <p className="lede">
            {start.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: zones.you.timeZone })} ·{" "}
            {`${timeYou(start)} ${zones.you.label} (${timeThem(start)} ${zones.them.label})`} · join 10–15 minutes early
          </p>
        </div>
        <div className="messages">
          <h3>Your three messages</h3>
          <ol>
            {messages.map((m) => (
              <li key={m.id}>{m.short}</li>
            ))}
          </ol>
          <p className="small muted">{pitch}</p>
        </div>
      </header>

      {serverDown && <Notice tone="bad">The Interview Coach server isn't answering. Start it again with “Start Interview Coach.bat”.</Notice>}

      <section className="card setup">
        <h2>Setup</h2>
        <div className="setup-row">
          <Chip tone={engine === "none" ? "bad" : "good"}>
            {engine === "none" ? "✗ No speech recognition in this browser" : `✓ Speech: ${engine === "browser" ? "built-in" : engine === "groq" ? "Groq Whisper" : "Azure"}`}
          </Chip>
          <Chip tone={status?.ai ? "good" : "bad"}>{status?.ai ? `✓ AI (${status.model})` : "✗ No AI key"}</Chip>
          <a href="#/details">
            <Chip tone={status && status.detailsFilled === status.detailsTotal ? "good" : "warn"}>
              My details {status?.detailsFilled ?? 0}/{status?.detailsTotal ?? 0}
            </Chip>
          </a>
        </div>
        {engine === "none" && (
          <p className="small">
            Firefox has no speech recognition. Open <b>http://localhost:5179</b> in <b>Chrome</b> (free, no key), or add a free <code>GROQ_API_KEY</code> to{" "}
            <code>.env</code> to practise in Firefox.
          </p>
        )}
        {status && !status.ai && (
          <p className="small muted">
            Paste a Groq or Gemini key into <code>.env</code> in the app folder and save; this page updates within a few seconds. No restart needed.
          </p>
        )}
        <SelfTest />
      </section>

      <section className="card plan">
        <h2>Suggested order</h2>
        <ol>
          <li>
            <a href="#/chinese">Chinese drill</a>: get every line of your Chinese introduction to 80+, then one full run.
          </li>
          <li>
            <a href="#/english">English practice</a>: two timed runs of your introduction (under 1:45), then “What do you know about {interview.companyShort}?”.
          </li>
          <li>
            <a href="#/case">Case questions</a>: learn the 6 C's, say the universal answer out loud three times, then answer two of the examples yourself.
          </li>
          <li>
            <a href="#/details">My details</a>: fill in the real numbers and stories. The mock interviewer digs into exactly these.
          </li>
          <li>
            <a href="#/mock">Mock interview</a> twice, and fix the top three points from each scorecard.
          </li>
          <li>
            <a href="#/quick">Quick-fire</a>: company facts and the process toolkit.
          </li>
          <li>Sleep early. In the morning: one Chinese full run, one English intro, then open the overlay from <a href="#/interview">Interview day</a>.</li>
        </ol>
      </section>

      <div className="tiles">
        {TILES.map((t) => (
          <a key={t.href} className="tile card" href={t.href}>
            <h3>{t.title}</h3>
            <p>{t.text}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
