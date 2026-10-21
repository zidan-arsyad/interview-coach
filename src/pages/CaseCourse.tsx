import { useState, type ReactNode } from "react";
import { casePrompts, caseStepHelp, caseUniversal, caseUnknown } from "../content/interview.ts";
import { VOICES, speak, stopSpeaking } from "../lib/audio.ts";
import { save } from "../lib/store.ts";

// Marks the six step words inside a model answer, so you can see the skeleton.
function withSteps(text: string): ReactNode[] {
  return text.split(/\b(clarify|contain|compare|cause|correct|copy(?: (?:it|the fix))? across)\b/i).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}

function practise(itemId: string) {
  save("en:item", itemId);
  location.hash = "#/english";
}

export function CaseCourse() {
  const [open, setOpen] = useState(casePrompts[0].id);
  const [playing, setPlaying] = useState<string | null>(null);

  const listen = async (id: string, text: string) => {
    if (playing === id) {
      stopSpeaking();
      setPlaying(null);
      return;
    }
    setPlaying(id);
    await speak(text, VOICES.enMale).catch(() => {});
    setPlaying((p) => (p === id ? null : p));
  };

  const current = casePrompts.find((p) => p.id === open) ?? casePrompts[0];

  return (
    <div className="page">
      <header className="page-head">
        <h1>Case questions</h1>
        <p className="lede">
          Expect at least one: a problem on the line or with people, and what you would do. Managers grade the order of your thinking more than the technical
          answer, so learn one method and use it every time.
        </p>
      </header>

      <section className="card">
        <h2>The 6 C's</h2>
        <div className="steps">
          {caseStepHelp.map((s, i) => (
            <div key={s.step} className="step">
              <div className="step-n">{i + 1}</div>
              <div>
                <h3>{s.step}</h3>
                <p>{s.say}</p>
                <p className="small muted">{s.words}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="transcript-head">
          <h2>The answer that fits almost any problem (about 55 s)</h2>
          <div className="row-gap">
            <button className="btn" onClick={() => void listen("universal", caseUniversal)}>
              {playing === "universal" ? "■ Stop" : "▶ Listen"}
            </button>
            <button className="btn btn-primary" onClick={() => practise("case-universal")}>
              Practise it
            </button>
          </div>
        </div>
        <p className="model">{withSteps(caseUniversal)}</p>
        <div className="tips">
          <p>
            <b>If you don't know the machine:</b> “{caseUnknown}”
          </p>
          <p>
            <b>How to start:</b> repeat the problem in one sentence, then “I'd approach it in six steps.” It's fine to assume a detail out loud: “Say the data
            shows bonder 3 since Tuesday.”
          </p>
          <p>
            <b>Two problems at once?</b> Safety first, then quality and the customer, then delivery, then cost. Contain both and tell your supervisor.
          </p>
        </div>
      </section>

      <section className="card">
        <h2>Worked examples</h2>
        <p className="small muted">Read one, listen to it, then answer it yourself in English practice. The marked words show the six steps.</p>
        <div className="tabs">
          {casePrompts.map((p) => (
            <button key={p.id} className={`tab${p.id === current.id ? " on" : ""}`} onClick={() => setOpen(p.id)}>
              {p.kind === "people" ? "People: " : ""}
              {p.prompt.split(/(?<=[.?])\s/)[0].replace(/[.?]$/, "")}
            </button>
          ))}
        </div>
        <h3 className="case-q">“{current.prompt}”</h3>
        <p className="small">
          <b>Check first:</b> {current.checkFirst}
        </p>
        <p className="model">{withSteps(current.model)}</p>
        <div className="row-gap">
          <button className="btn" onClick={() => void listen(current.id, current.model)}>
            {playing === current.id ? "■ Stop" : "▶ Listen"}
          </button>
          <button className="btn btn-primary" onClick={() => practise(`case-${current.id}`)}>
            Practise this one
          </button>
        </div>
      </section>
    </div>
  );
}
