// Interview clock helpers. The slot is in the interviewers' time zone; both zones come from the
// profile (interview.zones), e.g. Taiwan for them and WIB for you.
import { interview } from "../content/interview.ts";
import { load, save } from "./store.ts";

export type Slot = { date: string; start: string; minutes: number };

export const zones = interview.zones;

export function getSlot(): Slot {
  // Older saves used `startTW` for the start time.
  const saved = load<Partial<Slot> & { startTW?: string }>("slot", {});
  return {
    date: saved.date ?? interview.date,
    start: saved.start ?? saved.startTW ?? interview.start,
    minutes: saved.minutes ?? interview.minutes,
  };
}

export function setSlot(slot: Slot): void {
  save("slot", slot);
}

export function slotStart(slot: Slot): Date {
  return new Date(`${slot.date}T${slot.start}:00${interview.utcOffset}`);
}

const fmt = (timeZone: string, withSeconds: boolean) =>
  new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", ...(withSeconds && { second: "2-digit" }), hour12: false });

const THEM = fmt(zones.them.timeZone, false);
const THEMs = fmt(zones.them.timeZone, true);
const YOU = fmt(zones.you.timeZone, false);
const YOUs = fmt(zones.you.timeZone, true);

/** Time in the interviewers' zone. */
export const timeThem = (d: Date, seconds = false) => (seconds ? THEMs : THEM).format(d);
/** Time in your zone. */
export const timeYou = (d: Date, seconds = false) => (seconds ? YOUs : YOU).format(d);

export function countdown(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h} h ${String(m).padStart(2, "0")} min`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
