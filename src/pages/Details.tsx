import { useEffect, useRef, useState } from "react";
import { useApp } from "../state.tsx";
import { Notice } from "../components.tsx";

export function Details() {
  const { details, saveDetails, reloadDetails } = useApp();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  // Fill the boxes from the file once (and on Reload), not after every save: a save finishing
  // while you type in the next box must not overwrite what you typed.
  const filledFromFile = useRef(false);

  useEffect(() => {
    if (filledFromFile.current || !details.length) return;
    filledFromFile.current = true;
    setDraft(Object.fromEntries(details.map((d) => [d.id, d.answer])));
  }, [details]);

  async function reload() {
    filledFromFile.current = false;
    await reloadDetails();
  }

  const dirty = details.some((d) => (draft[d.id] ?? "") !== d.answer);
  const filled = details.filter((d) => (draft[d.id] ?? "").trim()).length;

  async function saveAll() {
    setState("saving");
    setError(null);
    // Send only what changed here, so edits made to my-details.md in Notepad are kept.
    const changed = Object.fromEntries(details.filter((d) => (draft[d.id] ?? "") !== d.answer).map((d) => [d.id, draft[d.id] ?? ""]));
    try {
      await saveDetails(changed);
      setState("saved");
      setTimeout(() => setState("idle"), 1500);
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    }
  }

  return (
    <div className="page">
      <header className="page-head row">
        <div>
          <h1>My details</h1>
          <p className="lede">
            Your real numbers and stories. Short bullet points are enough. They're saved to <code>profile/my-details.md</code> (private, not shared), so
            you can also edit that file directly.
          </p>
        </div>
        <div className="save-bar">
          <span className="muted small">
            {filled}/{details.length} filled
          </span>
          <button className="btn" onClick={() => void reload()} disabled={dirty} title="Reload profile/my-details.md from disk">
            Reload
          </button>
          <button className="btn btn-primary" onClick={() => void saveAll()} disabled={!dirty || state === "saving"}>
            {state === "saving" ? "Saving…" : state === "saved" ? "Saved ✓" : "Save"}
          </button>
        </div>
      </header>
      {error && <Notice tone="bad">{error}</Notice>}
      <div className="details">
        {details.map((d) => (
          <section key={d.id} className={`card detail${(draft[d.id] ?? "").trim() ? " filled" : ""}`}>
            <h3>{d.title}</h3>
            {d.hint && <p className="small muted">{d.hint}</p>}
            <textarea
              value={draft[d.id] ?? ""}
              onChange={(e) => setDraft({ ...draft, [d.id]: e.target.value })}
              onBlur={() => dirty && void saveAll()}
              rows={Math.max(3, (draft[d.id] ?? "").split("\n").length + 1)}
              placeholder="- your real detail"
            />
          </section>
        ))}
      </div>
    </div>
  );
}
