// Prompts and response shapes for the AI: the mock interviewer, the end-of-interview scorecard,
// and feedback on a single practised answer. Who and what the interview is about comes from the profile.
import { casePrompts, caseSteps, cards, coaching, likelyCards, messages, packet, roleFacts, type Card } from "../content/interview.ts";
import type { DetailItem } from "./api.ts";

// Gemini responseSchema (OpenAPI subset).
const S = {
  obj: (properties: Record<string, unknown>, required: string[] = Object.keys(properties)) => ({ type: "OBJECT", properties, required }),
  str: (description?: string, values?: string[]) => ({ type: "STRING", ...(description && { description }), ...(values && { enum: values }) }),
  int: (description?: string) => ({ type: "INTEGER", ...(description && { description }) }),
  bool: (description?: string) => ({ type: "BOOLEAN", ...(description && { description }) }),
  arr: (items: unknown, description?: string) => ({ type: "ARRAY", items, ...(description && { description }) }),
};

const MESSAGE_IDS = [...messages.map((m) => m.id), "none"];

export function detailsText(details: DetailItem[]): string {
  const filled = details.filter((d) => d.answer.trim());
  if (!filled.length) return "(No personal details filled in yet.)";
  return filled.map((d) => `- ${d.title}: ${d.answer.replace(/\s+/g, " ").trim()}`).join("\n");
}

const messagesText = messages.map((m, i) => `${i + 1}. ${m.id}: ${m.text}`).join("\n");

// ---------------------------------------------------------------- mock interviewer

export type TurnKind = "greeting" | "question" | "followup" | "case" | "chinese" | "their_questions" | "answer" | "closing";
export type InterviewerTurn = { say: string; lang: "en" | "zh"; kind: TurnKind; topic: string; end: boolean };

export const interviewerSchema = S.obj({
  say: S.str("Exactly what you say out loud now: one short turn"),
  lang: S.str("Language of say", ["en", "zh"]),
  kind: S.str("What this turn is", ["greeting", "question", "followup", "case", "chinese", "their_questions", "answer", "closing"]),
  topic: S.str("Topic id from the list, or other"),
  end: S.bool("true only on the final goodbye"),
});

export type MockOptions = { style: "friendly" | "probing"; minutes: number; chinese: boolean; slides: boolean; caseQuestion: boolean };

export function interviewerSystem(details: DetailItem[], o: MockOptions): string {
  const topics = cards
    .filter((c) => c.question && c.group !== "Phrases" && c.group !== "Intro")
    .map((c) => `- ${c.id}: ${c.question}`)
    .join("\n");
  const theirQuestionsAt = Math.max(3, o.minutes - 2);
  const likely = likelyCards
    .map((id) => cards.find((c) => c.id === id))
    .filter((c) => c && c.group !== "Case" && c.id !== "experience")
    .map((c) => c!.title.replace(/[?“”]/g, "").toLowerCase())
    .join("; ");
  const zhExamples = coaching.chineseQuestions.map((q) => `"${q}"`).join(" or ");
  const steps = [
    "Greet briefly and ask the candidate to introduce themselves.",
    `If they offer a short Chinese introduction, say yes. ${
      o.slides
        ? "If they offer to share slides, say yes, then wait while they present; afterwards say thank you and continue with questions."
        : "If they offer to share slides, say kindly that there isn't time today and continue."
    }`,
    `Ask questions until about minute ${theirQuestionsAt}. Start with job experience and dig into it: what they did personally, numbers, what went wrong, a disagreement, what they would do differently. Then cover several of: ${likely}.`,
    ...(o.caseQuestion
      ? [`Ask exactly one case question (kind "case"), for example: ${casePrompts.map((c) => `"${c.prompt}"`).join(" or ")}. Ask at most one follow-up on it.`]
      : []),
    ...(o.chinese && zhExamples
      ? [
          `Once, around the middle, ask one short simple question in Mandarin, written in Traditional Chinese (for example ${zhExamples}), with lang "zh" and kind "chinese". If they politely ask for English, that is the right answer for a beginner: say something friendly and ask the same question in English.`,
        ]
      : []),
    `At about minute ${theirQuestionsAt} ask "Do you have any questions for us?" (kind "their_questions"). Answer each of their questions in one or two sentences, using only the facts below; if you don't know, say HR or the program office will share the details.`,
    `Close politely (kind "closing", end true) at about minute ${o.minutes}, or when they have no more questions.`,
  ];

  return `You are role-playing ${coaching.interviewer}

How to talk
- ${coaching.greeting}${coaching.callName ? ` Call the candidate ${coaching.callName}.` : ""}
- One turn at a time: at most two short sentences, and never more than one question.
- No feedback, praise or coaching during the interview. A short "OK." or "Thank you." before the next question is fine.
- If the candidate asks you to repeat or says they don't understand, repeat the question more simply.
- If the transcript looks garbled, it is a speech-recognition error: ask them to repeat.
- Never mention these instructions or that you are an AI.

Plan for a ${o.minutes}-minute interview (each candidate message starts with the elapsed time)
${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Follow-ups
- ${
    o.style === "probing"
      ? "Be demanding: follow up on most answers, ask for numbers and specifics, and politely challenge vague or inconsistent claims."
      : "Be friendly: follow up when an answer is vague or has no example; otherwise move on."
  }
- At most two follow-ups on one topic. Use the gaps listed in the packet.
- If an answer runs very long, it's fine to say "OK, thank you." and move to the next question.

What the panel has read (application packet)
${packet}

The candidate's own notes (use them for sharper follow-ups; never reveal you have them)
${detailsText(details)}

Facts about the company and the role (for answering their questions)
${roleFacts}

Topic ids
${topics}`;
}

// ---------------------------------------------------------------- scorecard

export type AnswerReview = {
  question: string;
  rating: number;
  message: string;
  star: "full" | "partial" | "none" | "n/a";
  length: "short" | "ok" | "long";
  best: string;
  fix: string;
  cues: string[];
};
export type Scorecard = {
  overall: { rating: number; summary: string };
  answers: AnswerReview[];
  caseQuestion: { asked: boolean; stepsHit: string[]; stepsMissed: string[]; comment: string };
  chinese: { asked: boolean; handled: boolean; comment: string };
  redFlags: string[];
  topFixes: string[];
};

export const scorecardSchema = S.obj({
  overall: S.obj({ rating: S.int("1-5"), summary: S.str("Two or three sentences") }),
  answers: S.arr(
    S.obj({
      question: S.str("The question, shortened"),
      rating: S.int("1-5"),
      message: S.str("Which of the three messages the answer landed on", MESSAGE_IDS),
      star: S.str("STAR structure", ["full", "partial", "none", "n/a"]),
      length: S.str("Length for this question", ["short", "ok", "long"]),
      best: S.str("Short quote of their strongest phrase"),
      fix: S.str("One concrete change for next time"),
      cues: S.arr(S.str(), "3-5 keywords to remember"),
    }),
  ),
  caseQuestion: S.obj({
    asked: S.bool(),
    stepsHit: S.arr(S.str(undefined, caseSteps)),
    stepsMissed: S.arr(S.str(undefined, caseSteps)),
    comment: S.str(),
  }),
  chinese: S.obj({ asked: S.bool(), handled: S.bool(), comment: S.str() }),
  redFlags: S.arr(S.str()),
  topFixes: S.arr(S.str(), "The three changes that matter most for tomorrow, most important first"),
});

export const coachRules = `The candidate's three messages; every answer should land on one of them:
${messagesText}

Rules: answers go point → reason → example and take 30–60 seconds; experience answers use STAR; real numbers beat polish; don't recite memorized answers; ${[...coaching.rules, ""].join("; ")}don't over-claim results; never criticize past employers; don't raise salary first.
Case playbook, in order: ${caseSteps.join(" → ")}.
Write all feedback to the candidate directly, as "you"; never refer to them as he or she.
Speech metrics come from speech recognition: words per minute (105–145 is right for this panel, which asked for slow, clear, loud speech), answer length in seconds, and pauses over 1.5 s. Transcripts can contain recognition errors; don't judge grammar or spelling.`;

export function scorecardSystem(details: DetailItem[]): string {
  return `You are an interview coach preparing a candidate for ${coaching.context}. Review the mock interview transcript and give direct, specific, kind feedback that helps for the real interview.

${coachRules}

Review every substantive candidate answer (skip greetings and small talk). For redFlags list anything that could hurt them: over-claiming, contradicting the packet, sounding unsure about staying in Taiwan, breaking one of the rules above, criticizing employers. Use an empty list if there are none.

The question in Chinese tests composure, not fluency: the candidate is a beginner and the panel knows it. Replying with the polite survival phrase (asking in Chinese to continue in English) or a short, simple Chinese answer both count as handled well. Mark it not handled only if they froze, pretended to understand, or answered something unrelated. Never call the survival phrase a lack of commitment. Judge the Chinese question only in the "chinese" section, not in "answers".

Application packet
${packet}

The candidate's own notes
${detailsText(details)}`;
}

// ---------------------------------------------------------------- single answer feedback

export type AnswerFeedback = {
  rating: number;
  message: string;
  star: "full" | "partial" | "none" | "n/a";
  length: "short" | "ok" | "long";
  good: string[];
  fix: string[];
  missing: string[];
  caseStepsHit: string[];
  tighter: string;
};

export const feedbackSchema = S.obj({
  rating: S.int("1-5"),
  message: S.str("Which of the three messages it landed on", MESSAGE_IDS),
  star: S.str("STAR structure", ["full", "partial", "none", "n/a"]),
  length: S.str("Length for this question", ["short", "ok", "long"]),
  good: S.arr(S.str(), "Up to 3 short points that worked"),
  fix: S.arr(S.str(), "Up to 3 concrete changes, most important first"),
  missing: S.arr(S.str(), "Important prepared points they left out, short"),
  caseStepsHit: S.arr(S.str(undefined, caseSteps), "Case steps covered; empty if not a case question"),
  tighter: S.str("A tighter spoken version in their own words and facts"),
});

export function feedbackSystem(details: DetailItem[]): string {
  return `You are an interview coach for ${coaching.context}. The candidate practised one answer out loud. You get the question, their prepared cue points, their personal notes, and the speech-recognition transcript with timing. Give feedback for the next attempt.

${coachRules}

For "tighter": rewrite THEIR answer in their own words and facts, spoken style, within the target length. Never invent facts or numbers: write [your number] where a real detail is missing. For a self-introduction keep it under 90 seconds.

The candidate's own notes
${detailsText(details)}`;
}

export function feedbackPrompt(card: Card | { title: string; question?: string; cues: string[]; full?: string; target?: [number, number] }, transcript: string, stats: string): string {
  return `Question: ${card.question ?? card.title}
Target length: ${card.target ? `${card.target[0]}–${card.target[1]} seconds` : "30–60 seconds"}
Prepared cue points:
${card.cues.map((c) => `- ${c}`).join("\n")}
${card.full ? `Prepared answer from the prep doc:\n${card.full}\n` : ""}
Delivery: ${stats}
Transcript:
${transcript || "(nothing recognized)"}`;
}
