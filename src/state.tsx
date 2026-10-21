import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type DetailItem, type SavedAnswer, type Status } from "./lib/api.ts";
import { setAzureVoices } from "./lib/audio.ts";

type AppState = {
  status: Status | null;
  serverDown: boolean;
  details: DetailItem[];
  reloadDetails: () => Promise<void>;
  saveDetails: (answers: Record<string, string>) => Promise<void>;
  detail: (id: string) => string;
  answers: Record<string, SavedAnswer>;
  saveAnswer: (id: string, answer: SavedAnswer) => Promise<void>;
};

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [serverDown, setServerDown] = useState(false);
  const [details, setDetails] = useState<DetailItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, SavedAnswer>>({});

  useEffect(() => {
    let alive = true;
    const poll = () =>
      api
        .status()
        .then((s) => {
          if (!alive) return;
          setStatus(s);
          setServerDown(false);
          setAzureVoices(s.azure);
        })
        .catch(() => alive && setServerDown(true));
    poll();
    const id = setInterval(poll, 8000); // picks up keys pasted into .env while the app is open
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const reloadDetails = useCallback(async () => setDetails(await api.details()), []);
  useEffect(() => {
    reloadDetails().catch(() => {});
  }, [reloadDetails]);

  const saveDetails = useCallback(async (answers: Record<string, string>) => setDetails(await api.saveDetails(answers)), []);
  const detail = useCallback((id: string) => details.find((d) => d.id === id)?.answer ?? "", [details]);

  // Saved practice answers; re-read now and then so an open overlay picks up new practice.
  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .answers()
        .then((a) => alive && setAnswers(a))
        .catch(() => {});
    load();
    const id = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  const saveAnswer = useCallback(async (id: string, answer: SavedAnswer) => setAnswers(await api.saveAnswer(id, answer)), []);

  return <Ctx.Provider value={{ status, serverDown, details, reloadDetails, saveDetails, detail, answers, saveAnswer }}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const value = useContext(Ctx);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}
