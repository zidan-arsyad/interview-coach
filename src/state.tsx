import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type DetailItem, type Status } from "./lib/api.ts";
import { setAzureVoices } from "./lib/audio.ts";

type AppState = {
  status: Status | null;
  serverDown: boolean;
  details: DetailItem[];
  reloadDetails: () => Promise<void>;
  saveDetails: (answers: Record<string, string>) => Promise<void>;
  detail: (id: string) => string;
};

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [serverDown, setServerDown] = useState(false);
  const [details, setDetails] = useState<DetailItem[]>([]);

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

  return <Ctx.Provider value={{ status, serverDown, details, reloadDetails, saveDetails, detail }}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const value = useContext(Ctx);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}
