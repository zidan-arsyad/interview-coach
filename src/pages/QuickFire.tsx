import { useEffect, useState } from "react";
import { quickDecks, type QuickCard } from "../content/quick.ts";
import { VOICES, speak } from "../lib/audio.ts";
import { load, save } from "../lib/store.ts";
import { Kbd, useHotkeys } from "../components.tsx";

function shuffled<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function QuickFire() {
  const [deckId, setDeckId] = useState(() => load("quick:deck", quickDecks[0]?.id ?? ""));
  const deck = quickDecks.find((d) => d.id === deckId) ?? quickDecks[0];
  const [queue, setQueue] = useState<QuickCard[]>(() => shuffled(deck.cards));
  const [shown, setShown] = useState(false);
  const [right, setRight] = useState(0);
  const [missed, setMissed] = useState<QuickCard[]>([]);

  useEffect(() => {
    save("quick:deck", deck.id);
    setQueue(shuffled(deck.cards));
    setShown(false);
    setRight(0);
    setMissed([]);
  }, [deck]);

  const current = queue[0];

  const answer = (gotIt: boolean) => {
    if (!current || !shown) return;
    if (gotIt) setRight((n) => n + 1);
    else setMissed((m) => (m.includes(current) ? m : [...m, current]));
    // A missed card comes back a few cards later.
    setQueue((q) => {
      const rest = q.slice(1);
      if (gotIt) return rest;
      const at = Math.min(rest.length, 3);
      return [...rest.slice(0, at), current, ...rest.slice(at)];
    });
    setShown(false);
  };

  useHotkeys((e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (!shown) setShown(true);
      else answer(true);
    } else if (e.key === "ArrowRight" || e.key === "g" || e.key === "G") answer(true);
    else if (e.key === "ArrowLeft" || e.key === "m" || e.key === "M") answer(false);
  });

  return (
    <div className="page">
      <header className="page-head">
        <h1>Quick-fire</h1>
        <p className="lede">Say the answer out loud before you reveal it. Missed cards come back until you get them.</p>
      </header>
      <div className="tabs">
        {quickDecks.map((d) => (
          <button key={d.id} className={`tab${d.id === deck.id ? " on" : ""}`} onClick={() => setDeckId(d.id)}>
            {d.title}
          </button>
        ))}
      </div>
      <section className="card flash">
        {current ? (
          <>
            <p className="small muted">
              {right} done · {queue.length} left{missed.length ? ` · ${missed.length} missed so far` : ""}
            </p>
            <h2 className="flash-q">{current.q}</h2>
            {shown ? (
              <>
                <p className="flash-a">{current.a}</p>
                {current.zh && (
                  <button className="btn" onClick={() => void speak(current.zh!, VOICES.zhFemale)}>
                    ▶ Hear it
                  </button>
                )}
                <div className="controls">
                  <button className="btn btn-good" onClick={() => answer(true)}>
                    Got it <Kbd>→</Kbd>
                  </button>
                  <button className="btn btn-danger" onClick={() => answer(false)}>
                    Missed <Kbd>←</Kbd>
                  </button>
                </div>
              </>
            ) : (
              <div className="controls">
                <button className="btn btn-primary btn-lg" onClick={() => setShown(true)}>
                  Show answer <Kbd>Space</Kbd>
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="center">
            <h2>Deck done: {right} right first time{missed.length ? `, ${missed.length} needed review` : ""}.</h2>
            <button className="btn btn-primary" onClick={() => (setQueue(shuffled(deck.cards)), setRight(0), setMissed([]))}>
              Go again
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
