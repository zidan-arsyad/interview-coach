import { useEffect, useState } from "react";
import { getSlot, setSlot, slotStart, timeThem, timeYou, zones, type Slot } from "../lib/time.ts";
import { closeOverlay, onOverlayClosed, openOverlay, pipSupported } from "../overlay/pip.tsx";
import { Overlay } from "../overlay/Overlay.tsx";
import { interview } from "../content/interview.ts";
import { load, save } from "../lib/store.ts";
import { Notice } from "../components.tsx";

function checklist(joinBy: string): { id: string; text: string }[] {
  const app = interview.platform;
  return [
    { id: "link", text: `Check your group chat for the ${app} link and any change to your slot.` },
    { id: "chrome", text: `Open the ${app} link. On the preview screen, check camera and microphone, with the camera at eye level.` },
    { id: "join", text: `Join 10–15 minutes early (by ${joinBy}). If the previous interview runs over, wait and follow the group's instructions.` },
    { id: "overlay", text: "In Chrome or Edge, open this page and the overlay, then drag it to just under your webcam, so glancing at it still looks like eye contact." },
    { id: "captions", text: `Optional: turn on captions in ${app} if it has them. Only you see them, and they help with accents.` },
    { id: "present", text: "To show slides, share a window (the slideshow), not your whole screen. Stop sharing after the last slide so they see your face." },
    { id: "quiet", text: "Phone on silent, notifications off, water out of view. Quiet, bright, tidy spot; formal clothes." },
    { id: "backup", text: "Devices charged, phone hotspot ready as a backup connection." },
    { id: "manner", text: "Smile, look at the camera, speak slowly and loudly, and hear the whole question before answering." },
    { id: "after", text: "Thank them at the end, then write down what to improve." },
  ];
}

export function InterviewDay() {
  const [slot, setSlotState] = useState<Slot>(getSlot);
  const [done, setDone] = useState<Record<string, boolean>>(() => load("checklist", {}));
  const [note, setNote] = useState<string | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const start = slotStart(slot);
  useEffect(() => onOverlayClosed(() => setOverlayOpen(false)), []);

  const update = (patch: Partial<Slot>) => {
    const next = { ...slot, ...patch };
    setSlot(next);
    setSlotState(next);
  };
  const toggle = (id: string) => {
    const next = { ...done, [id]: !done[id] };
    setDone(next);
    save("checklist", next);
  };

  async function open() {
    setNote(null);
    try {
      const how = await openOverlay();
      setOverlayOpen(how !== "blocked");
      if (how === "popup") setNote("Opened as a normal window (this browser can't keep it on top). Chrome or Edge can.");
      if (how === "blocked") setNote("The browser blocked the window. Allow pop-ups for localhost and try again.");
    } catch (e) {
      setNote((e as Error).message);
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Interview day</h1>
        <p className="lede">{`${timeYou(start)} ${zones.you.label} · ${timeThem(start)} ${zones.them.label} · ${slot.minutes} minutes on ${interview.platform}`}</p>
      </header>

      <section className="card overlay-launch">
        <div>
          <h2>Cue overlay</h2>
          <p>
            A small window that stays on top of {interview.platform} and your slides. It shows the clock, where you should be in your plan, your three messages, and the card
            for the current part. Type a word (“stress”, “why”, “case”) and press Enter to jump to a card; <b>1</b>–<b>6</b> open the quick cards; <b>Esc</b> or <b>0</b> goes
            back to the plan.
          </p>
          <p className="small muted">
            Keyword cues, not scripts: reciting full sentences shows on camera and sounds memorized. If the interview starts late, press “Start now” at
            the real start.
          </p>
          <div className="row-gap">
            <button className="btn btn-primary btn-lg" onClick={() => void open()}>
              {overlayOpen ? "Bring the overlay back" : "Open the overlay"}
            </button>
            {overlayOpen && (
              <button className="btn btn-lg" onClick={() => (closeOverlay(), setOverlayOpen(false))}>
                Close the overlay
              </button>
            )}
          </div>
          <p className="small muted">To close it, click ✕ on the overlay itself, use this button, or close this tab.</p>
          {!pipSupported() && (
            <Notice tone="warn">
              This browser (Firefox) can't keep a window on top. For the interview, open <b>http://localhost:5179/#/interview</b> in <b>Chrome</b> or <b>Edge</b>{" "}
              and open the overlay there. Google Meet can stay in Firefox: the overlay floats above every window.{" "}
              <button className="link" onClick={() => void navigator.clipboard?.writeText("http://localhost:5179/#/interview").then(() => setNote("Link copied."))}>
                Copy the link
              </button>
            </Notice>
          )}
          {note && <Notice tone="info">{note}</Notice>}
        </div>
        <div className="slot-form">
          <h3>Your slot ({zones.them.label} time)</h3>
          <label>
            Date
            <input type="date" value={slot.date} onChange={(e) => update({ date: e.target.value })} />
          </label>
          <label>
            Start
            <input type="time" value={slot.start} onChange={(e) => update({ start: e.target.value })} />
          </label>
          <label>
            Minutes
            <input type="number" min={5} max={60} value={slot.minutes} onChange={(e) => update({ minutes: Number(e.target.value) || 15 })} />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Try it here</h2>
        <p className="small muted">The same overlay, inside the page. Click into it and type.</p>
        <div className="overlay-preview">
          <Overlay win={window} embedded />
        </div>
      </section>

      <section className="card">
        <h2>Checklist for the morning</h2>
        <ul className="checklist">
          {checklist(`${timeYou(new Date(start.getTime() - 15 * 60000))}–${timeYou(new Date(start.getTime() - 10 * 60000))} ${zones.you.label}`).map((c) => (
            <li key={c.id}>
              <label>
                <input type="checkbox" checked={Boolean(done[c.id])} onChange={() => toggle(c.id)} /> {c.text}
              </label>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
