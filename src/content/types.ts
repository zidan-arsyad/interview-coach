// The shape of a profile (profile/interview.ts, zh.ts, quick.ts). The app's code only ever reads
// these; everything about a particular person and interview lives in the profile folder.

export type Zone = { label: string; timeZone: string };

export type InterviewInfo = {
  company: string; // full name, used in AI prompts
  companyShort: string; // short name for the screen
  role: string;
  program: string;
  platform: string; // e.g. Google Meet
  date: string; // YYYY-MM-DD, in the interviewers' time zone
  start: string; // HH:MM, in the interviewers' time zone
  utcOffset: string; // the interviewers' UTC offset, e.g. +08:00
  minutes: number;
  zones: { them: Zone; you: Zone };
  spellCheck?: { word: string; sayAs: string }; // warn when this word is spelled out letter by letter
};

export type Segment = { id: string; label: string; from: number; to: number; card: string }; // minutes from the start
export type Message = { id: string; short: string; text: string };
export type Slide = { n: number; title: string; say: string; bridge: string };

export type CardGroup = "Intro" | "Core" | "Pre-hire" | "Common" | "Tough" | "Case" | "Phrases" | "Reference";
export type Card = {
  id: string;
  title: string;
  group: CardGroup;
  question?: string; // how an interviewer might ask it
  keys?: string; // extra words for overlay search
  cues: string[];
  full?: string; // a prepared answer, for the "full text" view and AI feedback
  details?: string[]; // my-details.md ids shown under the cues
  zhSet?: string; // Chinese lines shown on the card
  target?: [number, number]; // answer length in seconds
};

export type CaseStepHelp = { step: string; say: string; words: string };
export type CasePrompt = { id: string; prompt: string; kind: "process" | "people"; checkFirst: string; model: string };

export type Coaching = {
  interviewer: string; // who the AI interviewer plays, and how they talk
  context: string; // "a 15-minute … interview …", for the coach's prompts
  callName: string; // what the interviewer calls you
  greeting: string; // e.g. It's morning in Taiwan: greet with "Good morning".
  chineseQuestions: string[]; // short questions in Chinese the interviewer may ask once
  rules: string[]; // extra do/don't rules the feedback should check
};

export type ZhLine = { id: string; zh: string; py: string; en: string; tip?: string };
export type ZhSet = { id: string; title: string; note?: string; lines: ZhLine[]; fullRunSeconds?: number };

export type QuickCard = { q: string; a: string; zh?: string };
export type QuickDeck = { id: string; title: string; cards: QuickCard[] };
