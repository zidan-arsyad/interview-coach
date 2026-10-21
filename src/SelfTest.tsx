// "Test my setup": checks the speech engine, the voices and Gemini, so problems show up before
// practice instead of during it.
import { useState } from "react";
import { zhSets } from "./content/zh.ts";
import { api } from "./lib/api.ts";
import { VOICES, bestVoice } from "./lib/audio.ts";
import { decodeToPcm } from "./lib/recorder.ts";
import { pickEngine, recognizePcm } from "./lib/speech.ts";
import { compareZh } from "./lib/zhCompare.ts";
import { useApp } from "./state.tsx";

type Check = { name: string; state: "running" | "ok" | "warn" | "fail"; detail: string };

export function SelfTest() {
  const { status } = useApp();
  const [checks, setChecks] = useState<Check[]>([]);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    const results: Check[] = [];
    const show = (c: Check) => {
      const i = results.findIndex((r) => r.name === c.name);
      if (i >= 0) results[i] = c;
      else results.push(c);
      setChecks([...results]);
    };
    const engine = pickEngine(status);

    // Speech recognition
    const intro = zhSets[0];
    if (engine === "azure" && intro) {
      const line = intro.lines[Math.min(5, intro.lines.length - 1)];
      show({ name: "Azure", state: "running", detail: "Scoring a synthetic Taiwan voice (~10 s)…" });
      try {
        const mp3 = await api.tts(line.zh, VOICES.zhFemale);
        const r = await recognizePcm(await decodeToPcm(await mp3.arrayBuffer()), { language: "zh-TW", referenceText: line.zh, assess: true });
        const score = r.scores?.overall;
        show({ name: "Azure", state: score !== undefined ? "ok" : "fail", detail: score !== undefined ? `voice and scoring work (score ${Math.round(score)})` : `no score came back` });
      } catch (e) {
        show({ name: "Azure", state: "fail", detail: (e as Error).message });
      }
    } else if (engine === "groq") {
      show({ name: "Speech recognition", state: "running", detail: "Sending a sample recording to Groq…" });
      try {
        const t = await api.selftestGroq();
        if (t.sample && intro) {
          const check = compareZh(intro.lines.map((l) => l.zh).join(""), intro.lines.map((l) => l.py).join(" "), t.text);
          show({ name: "Speech recognition", state: "ok", detail: `Groq works. Your sample came through as ${Math.round(check.understood)}% of your Chinese introduction.` });
        } else {
          show({ name: "Speech recognition", state: "ok", detail: "Groq works (checked with a test tone; put a recording at profile/sample.mp3 to test with your own voice)." });
        }
      } catch (e) {
        show({ name: "Speech recognition", state: "fail", detail: (e as Error).message });
      }
    } else if (engine === "browser") {
      show({ name: "Speech recognition", state: "ok", detail: "this browser's built-in recognition (it will ask for the microphone on your first recording)" });
    } else {
      show({ name: "Speech recognition", state: "fail", detail: "none in this browser. Open the app in Chrome, or add a free GROQ_API_KEY to .env" });
    }

    // Voices
    if (!status?.azure) {
      const zh = await bestVoice("zh-TW");
      const en = await bestVoice("en-US");
      show({
        name: "Chinese voice",
        state: zh.quality === "taiwan" ? "ok" : zh.quality === "none" ? "fail" : "warn",
        detail: zh.voice ? `${zh.voice.name}${zh.quality === "mainland" ? " (mainland accent: Chrome or Edge has a Taiwan voice)" : ""}` : "none: use Chrome or Edge, or the Google Translate button",
      });
      show({ name: "English voice", state: en.voice ? "ok" : "fail", detail: en.voice?.name ?? "none" });
    }

    // AI (Groq first, Gemini as backup)
    if (status?.ai) {
      show({ name: "AI", state: "running", detail: "" });
      try {
        const r = await api.llm<{ ok: boolean; say: string }>({
          system: "You are a test endpoint. Reply in JSON.",
          messages: [{ role: "user", text: 'Reply with {"ok": true, "say": "ready"}' }],
          schema: { type: "OBJECT", properties: { ok: { type: "BOOLEAN" }, say: { type: "STRING" } }, required: ["ok", "say"] },
          temperature: 0,
          maxTokens: 1024,
        });
        const s = await api.status();
        show({ name: "AI", state: r.ok ? "ok" : "fail", detail: `model ${s.model} answered “${r.say}”` });
      } catch (e) {
        show({ name: "AI", state: "fail", detail: (e as Error).message });
      }
    } else {
      show({ name: "AI", state: "fail", detail: "no GEMINI_API_KEY or GROQ_API_KEY in .env (needed for the AI interviewer and feedback)" });
    }
    setBusy(false);
  }

  return (
    <div className="selftest">
      <button className="btn" onClick={() => void run()} disabled={busy}>
        {busy ? "Testing…" : "Test my setup"}
      </button>
      {checks.length > 0 && (
        <ul>
          {checks.map((c) => (
            <li key={c.name} className={`check-${c.state}`}>
              {c.state === "ok" ? "✓" : c.state === "fail" ? "✗" : c.state === "warn" ? "!" : "…"} <b>{c.name}</b> {c.detail}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
