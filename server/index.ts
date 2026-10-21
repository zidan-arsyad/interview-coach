// Interview Coach: a local server on http://localhost:5179. It builds the browser app with esbuild,
// serves it, and keeps the API keys from .env on this machine (the browser only gets short-lived tokens).
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import * as esbuild from "esbuild";
import { ROOT, readConfig } from "./env.ts";
import { HttpError, readJson, readRaw, sendError, sendJson } from "./http.ts";
import { speechToken, synthesize } from "./azure.ts";
import { transcribe } from "./groq.ts";
import type { LlmRequest } from "./gemini.ts";
import { currentModel, generate } from "./llm.ts";
import { readDetails, writeDetails } from "./details.ts";
import { listSessions, readSession, saveSession } from "./sessions.ts";
import { PROFILE, ensureEnvFile, ensureProfile } from "./profile.ts";

const portArg = process.argv.indexOf("--port");
const PORT = Number((portArg > 0 && process.argv[portArg + 1]) || process.env.PORT || 5179);
const PUBLIC = join(ROOT, "public");
const buildOnly = process.argv.includes("--build-only");
const dev = process.argv.includes("--dev");

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
};

async function buildClient(): Promise<void> {
  const ctx = await esbuild.context({
    entryPoints: [join(ROOT, "src", "main.tsx")],
    bundle: true,
    outdir: join(PUBLIC, "build"),
    format: "esm",
    platform: "browser",
    target: ["chrome120", "edge120"],
    jsx: "automatic",
    sourcemap: true,
    minify: !dev,
    define: { "process.env.NODE_ENV": dev ? '"development"' : '"production"' },
    logLevel: "warning",
  });
  if (buildOnly) {
    await ctx.rebuild();
    await ctx.dispose();
  } else {
    await ctx.watch(); // rebuilds when a file in src/ changes
  }
}

async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const route = `${req.method} ${url.pathname}`;
  switch (route) {
    case "GET /api/status": {
      const cfg = readConfig();
      const details = await readDetails();
      return sendJson(res, 200, {
        ai: Boolean(cfg.geminiKey || cfg.groqKey),
        gemini: Boolean(cfg.geminiKey),
        azure: Boolean(cfg.azureKey),
        groq: Boolean(cfg.groqKey),
        region: cfg.azureRegion,
        model: currentModel(),
        detailsFilled: details.filter((d) => d.answer).length,
        detailsTotal: details.length,
      });
    }
    case "GET /api/speech-token":
      return sendJson(res, 200, await speechToken());
    case "POST /api/tts": {
      const body = await readJson<{ text: string; voice: string; rate?: number }>(req);
      const audio = await synthesize(body.text, body.voice, body.rate ?? 1);
      res.writeHead(200, { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" });
      return void res.end(audio);
    }
    case "POST /api/transcribe": {
      const lang = url.searchParams.get("lang");
      const audio = await readRaw(req);
      return sendJson(res, 200, await transcribe(audio, lang === "zh" || lang === "en" ? lang : "auto"));
    }
    case "GET /api/selftest/groq": {
      // profile/sample.mp3 (optional): a recording of your Chinese introduction to transcribe.
      // Without one, a short tone checks that the key works.
      const sample = await readFile(join(PROFILE, "sample.mp3")).catch(() => null);
      if (sample) return sendJson(res, 200, { ...(await transcribe(sample, "zh", "sample.mp3")), sample: true });
      return sendJson(res, 200, { ...(await transcribe(toneWav(), "en", "tone.wav")), sample: false });
    }
    case "POST /api/llm": {
      const body = await readJson<LlmRequest>(req);
      return sendJson(res, 200, await generate(body));
    }
    case "GET /api/details":
      return sendJson(res, 200, await readDetails());
    case "PUT /api/details": {
      const body = await readJson<{ answers: Record<string, string> }>(req);
      return sendJson(res, 200, await writeDetails(body.answers ?? {}));
    }
    case "GET /api/sessions":
      return sendJson(res, 200, await listSessions());
    case "POST /api/sessions":
      return sendJson(res, 200, await saveSession(await readJson(req, 20_000_000)));
  }
  if (req.method === "GET" && url.pathname.startsWith("/api/sessions/")) {
    return sendJson(res, 200, await readSession(decodeURIComponent(url.pathname.slice("/api/sessions/".length))));
  }
  throw new HttpError(404, `No API route ${route}`);
}

async function serveStatic(res: ServerResponse, pathname: string): Promise<void> {
  const rel = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
  const file = normalize(join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + sep)) throw new HttpError(403, "Forbidden");
  let body: Buffer;
  try {
    body = await readFile(file);
  } catch {
    throw new HttpError(404, "Not found");
  }
  res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-cache" });
  res.end(body);
}

/** One second of 16 kHz tone as WAV, to check a speech key without any recording. */
function toneWav(): Buffer {
  const rate = 16000;
  const pcm = Buffer.alloc(rate * 2);
  for (let i = 0; i < rate; i++) pcm.writeInt16LE(Math.round(6000 * Math.sin((2 * Math.PI * 330 * i) / rate)), i * 2);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

ensureProfile();
ensureEnvFile();
await buildClient();
if (buildOnly) {
  console.log("Built public/build/");
  process.exit(0);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname.startsWith("/api/")) await handleApi(req, res, url);
    else await serveStatic(res, url.pathname);
  } catch (err) {
    if (!res.headersSent) sendError(res, err);
    else res.end();
  }
});
server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.log(`\n  Interview Coach is already running. Open http://localhost:${PORT} in Chrome.\n`);
    process.exit(0);
  }
  throw err;
});
server.listen(PORT, "127.0.0.1", () => {
  const cfg = readConfig();
  console.log(`\n  Interview Coach is running at http://localhost:${PORT}\n`);
  console.log(`  Gemini key: ${cfg.geminiKey ? "found" : "missing (add GEMINI_API_KEY to .env)"}`);
  console.log(`  Groq key:   ${cfg.groqKey ? "found" : "not set (optional: speech recognition in Firefox)"}`);
  console.log(`  Azure key:  ${cfg.azureKey ? `found (region ${cfg.azureRegion})` : "not set (optional)"}`);
  console.log(`\n  Keep this window open while you practise. Press Ctrl+C to stop.\n`);
});
