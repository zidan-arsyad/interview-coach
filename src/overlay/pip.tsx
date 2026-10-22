// Opens the overlay in an always-on-top window (Chrome/Edge Document Picture-in-Picture), or a
// normal popup where that isn't available.
import { createRoot } from "react-dom/client";
import { AppProvider } from "../state.tsx";
import { Overlay } from "./Overlay.tsx";

type DocumentPip = { requestWindow(options: { width: number; height: number }): Promise<Window>; window: Window | null };

export function pipSupported(): boolean {
  return "documentPictureInPicture" in window;
}

let popup: Window | null = null;
const closedListeners = new Set<() => void>();

/** Calls back when the overlay window closes (its ✕, this page's button, or the tab closing). */
export function onOverlayClosed(fn: () => void): () => void {
  closedListeners.add(fn);
  return () => void closedListeners.delete(fn);
}

export function closeOverlay(): void {
  const dpip = (window as unknown as { documentPictureInPicture?: DocumentPip }).documentPictureInPicture;
  dpip?.window?.close();
  popup?.close();
  popup = null;
}

function watchClose(win: Window) {
  win.addEventListener("pagehide", () => closedListeners.forEach((fn) => fn()));
}

export async function openOverlay(): Promise<"pip" | "popup" | "blocked"> {
  const dpip = (window as unknown as { documentPictureInPicture?: DocumentPip }).documentPictureInPicture;
  let pip: Window | null = null;
  if (dpip) {
    if (dpip.window) {
      dpip.window.focus();
      return "pip";
    }
    try {
      pip = await dpip.requestWindow({ width: 600, height: 520 });
    } catch {
      pip = null; // e.g. an embedded browser without picture-in-picture: use a popup instead
    }
  }
  if (pip) {
    for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')) {
      const copy = pip.document.createElement("link");
      copy.rel = "stylesheet";
      copy.href = link.href;
      pip.document.head.appendChild(copy);
    }
    pip.document.title = "Interview cues";
    pip.document.documentElement.classList.add("overlay-doc");
    const mount = pip.document.createElement("div");
    pip.document.body.appendChild(mount);
    const root = createRoot(mount);
    root.render(
      <AppProvider>
        <Overlay win={pip} />
      </AppProvider>,
    );
    pip.addEventListener("pagehide", () => root.unmount());
    watchClose(pip);
    return "pip";
  }
  popup = window.open("/#/overlay", "interview-cues", "popup,width=600,height=520");
  if (popup) watchClose(popup);
  return popup ? "popup" : "blocked";
}
