import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { AppProvider, useApp } from "./state.tsx";
import { Home } from "./pages/Home.tsx";
import { ChineseDrill } from "./pages/ChineseDrill.tsx";
import { EnglishPractice } from "./pages/EnglishPractice.tsx";
import { MockInterview } from "./pages/MockInterview.tsx";
import { CaseCourse } from "./pages/CaseCourse.tsx";
import { QuickFire } from "./pages/QuickFire.tsx";
import { Details } from "./pages/Details.tsx";
import { InterviewDay } from "./pages/InterviewDay.tsx";
import { Overlay } from "./overlay/Overlay.tsx";
import { stopSpeaking } from "./lib/audio.ts";
import { pickEngine } from "./lib/speech.ts";

const PAGES: { path: string; label: string; page: ComponentType }[] = [
  { path: "/", label: "Home", page: Home },
  { path: "/chinese", label: "Chinese", page: ChineseDrill },
  { path: "/english", label: "English", page: EnglishPractice },
  { path: "/case", label: "Case questions", page: CaseCourse },
  { path: "/mock", label: "Mock interview", page: MockInterview },
  { path: "/quick", label: "Quick-fire", page: QuickFire },
  { path: "/details", label: "My details", page: Details },
  { path: "/interview", label: "Interview day", page: InterviewDay },
];

function useHashPath(): string {
  const read = () => location.hash.replace(/^#/, "") || "/";
  const [path, setPath] = useState(read);
  useEffect(() => {
    const onChange = () => {
      stopSpeaking();
      setPath(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return path;
}

export function App() {
  const path = useHashPath();
  // The pop-up overlay fills its window like the picture-in-picture one.
  document.documentElement.classList.toggle("overlay-doc", path === "/overlay");
  if (path === "/overlay")
    return (
      <AppProvider>
        <Overlay win={window} />
      </AppProvider>
    );
  const Page = (PAGES.find((p) => p.path === path) ?? PAGES[0]).page;
  return (
    <AppProvider>
      <Shell path={path}>
        <Page />
      </Shell>
    </AppProvider>
  );
}

function Shell({ path, children }: { path: string; children: ReactNode }) {
  const { status } = useApp();
  return (
    <>
      <nav className="nav">
        <a className="brand" href="#/">
          Interview Coach
        </a>
        <div className="nav-links">
          {PAGES.slice(1).map((p) => (
            <a key={p.path} href={`#${p.path}`} className={p.path === path ? "on" : ""}>
              {p.label}
            </a>
          ))}
        </div>
        <div className="nav-status" title="Speech recognition in this browser, and an AI key (Groq or Gemini) in .env">
          <span className={`dot ${pickEngine(status) !== "none" ? "dot-on" : "dot-off"}`} /> Speech
          <span className={`dot ${status?.ai ? "dot-on" : "dot-off"}`} /> AI
        </div>
      </nav>
      <main>{children}</main>
    </>
  );
}
