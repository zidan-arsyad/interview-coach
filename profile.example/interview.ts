// EXAMPLE PROFILE. The app copies this folder to profile/ the first time it runs; edit the copy
// in profile/ (private, git-ignored), not this file. Replace every [bracket] with your own words.
// This example is set up for a SPIL Process Engineer interview in the NCUE INTENSE Program; for
// another company, also change the company facts, why-company card, case prompts and coaching.
import type { Card, CasePrompt, CaseStepHelp, Coaching, InterviewInfo, Message, Segment, Slide } from "../src/content/types.ts";
import { shorten } from "../src/content/helpers.ts";

export const interview: InterviewInfo = {
  company: "SPIL (Siliconware Precision Industries, 矽品精密), part of ASE",
  companyShort: "SPIL",
  role: "Process Engineer (製程工程師)",
  program: "NCUE INTENSE Program",
  platform: "Google Meet",
  // Your slot, in the interviewers' time zone (also editable on the app's Interview day page).
  date: "2026-11-02",
  start: "09:00",
  utcOffset: "+08:00",
  minutes: 15,
  zones: { them: { label: "TW", timeZone: "Asia/Taipei" }, you: { label: "WIB", timeZone: "Asia/Jakarta" } },
  // Warns you in English practice if you spell this out letter by letter.
  spellCheck: { word: "SPIL", sayAs: "spill" },
};

// Minutes from the start of the slot: what you should be doing when. The overlay follows this plan.
export const segments: Segment[] = [
  { id: "greeting", label: "Greeting", from: 0, to: 0.5, card: "intro-en" },
  { id: "intro-en", label: "English intro", from: 0.5, to: 2, card: "intro-en" },
  { id: "intro-zh", label: "Chinese intro", from: 2, to: 3, card: "intro-zh" },
  { id: "slides", label: "Slides", from: 3, to: 5, card: "slides" },
  { id: "their-q", label: "Their questions", from: 5, to: 13, card: "home" },
  { id: "your-q", label: "Your questions", from: 13, to: 15, card: "your-questions" },
];

// Three things every answer should come back to. Feedback checks which one each answer landed on.
// Write all of this in your own words: panels notice when candidates sound the same.
export const messages: Message[] = [
  { id: "m1", short: "[Message 1, a few words]", text: "[Your first key message, in one sentence.]" },
  { id: "m2", short: "[Message 2, a few words]", text: "[Your second key message: your best proof, with a number.]" },
  { id: "m3", short: "[Message 3, a few words]", text: "[Your third key message.]" },
];

export const pitch = "[One sentence about you, in your own words.]";

// An outline, not a script: write your own sentences for each part.
export const introEnglish = [
  "[Part 1: greeting, your name, where you're from.]",
  "[Part 2: your education, and one thing it taught you.]",
  "[Part 3: your strongest experience, what you did yourself, and one result with a number.]",
  "[Part 4: why this role and this company, with one specific reason.]",
  "[Part 5: your plan, and a short closing.]",
];

export const slides: Slide[] = [
  { n: 1, title: "[Slide 1]", say: "[What you say on this slide, in one or two sentences.]", bridge: "[A line that leads to the next slide.]" },
  { n: 2, title: "[Slide 2]", say: "[What you say on this slide.]", bridge: "[Bridge to the next slide.]" },
  { n: 3, title: "[Slide 3]", say: "[What you say on this slide.]", bridge: "[Bridge to the next slide.]" },
  { n: 4, title: "[Last slide]", say: "[Your summary.]", bridge: "[How you hand back to their questions.]" },
];

// A case answer that works for almost any process problem (about 55 seconds).
export const caseUniversal =
  "First I'd clarify: which product and machine, since when, and how big is the problem? Then I'd contain it: hold the suspect lots, follow the OCAP, and tell my supervisor and QA. Next I'd compare good and bad lots by machine, shift, material lot, recipe and time, check the SPC charts, and make sure the measurement itself is right. To find the cause, I'd use 5 Whys and the fishbone with the equipment engineer, and confirm it with a test lot. Then I'd correct one thing at a time and watch SPC and yield on the next lots. Finally I'd copy the fix across: update the SOP, write the 8D if the customer saw it, and apply it to similar machines.";

// Cue cards: what the overlay shows and what you practise. Cues are keywords, not scripts.
// `details` pulls in your answers from my-details.md under the cues.
export const cards: Card[] = [
  {
    id: "intro-en",
    title: "English self-introduction",
    group: "Intro",
    question: "Please introduce yourself.",
    keys: "introduce yourself self introduction tell me about yourself",
    target: [75, 105],
    cues: [
      "[Part 1 keywords]",
      "[Part 2 keywords]",
      "[Part 3 keywords + your number]",
      "[Part 4 keywords]",
      "[Part 5 keywords]",
      "Then switch to Chinese, in your own words",
    ],
    full: introEnglish.join("\n\n"),
  },
  {
    id: "intro-zh",
    title: "Chinese self-introduction",
    group: "Intro",
    question: "Can you also introduce yourself in Chinese?",
    keys: "chinese mandarin zhongwen 中文 自我介紹",
    target: [20, 45],
    zhSet: "intro",
    cues: ["Start with a short line that switches to Chinese", "End by asking to continue in English"],
  },
  {
    id: "slides",
    title: "Slides (about 2 min)",
    group: "Intro",
    keys: "presentation share screen slides present",
    target: [100, 140],
    cues: [
      "Ask before sharing your screen; if they'd rather not, go straight to their questions",
      "Share only the slideshow window, and check they can see it",
      ...slides.map((s) => `${s.n} ${s.title}: ${shorten(s.say)} → ${s.bridge}`),
      "Interrupted: answer first, then ask whether to continue",
      "Short on time: jump to your last slide",
    ],
    full: slides.map((s) => `${s.n}. ${s.title}: ${s.say} (${s.bridge})`).join("\n"),
  },
  {
    id: "background",
    title: "Academic background & skills",
    group: "Core",
    question: "Tell us about your academic background and professional skills.",
    keys: "education degree skills study major",
    target: [30, 60],
    details: ["skill-example"],
    cues: ["Base: [degree and what it taught you]", "Now: [current study or job]", "Most useful for this role: [two or three skills]", "Example: one piece of work and what it showed"],
  },
  {
    id: "research",
    title: "Current research or project",
    group: "Core",
    question: "What is your current research about?",
    keys: "thesis research project",
    target: [30, 60],
    details: ["research-status"],
    cues: ["One breath: [what it is, in plain words]", "Why it matters: [who it helps]", "Link to the role: [how it connects to process work]", "Real status only: don't claim results you can't show"],
  },
  {
    id: "know-spil",
    title: "What do you know about SPIL?",
    group: "Core",
    question: "What do you know about SPIL?",
    keys: "company about spil history siliconware",
    target: [25, 45],
    cues: [
      "Packages and tests chips for customers worldwide · about 25,000 employees",
      "Founded 1984 in Taichung · joined the ASE group in 2018",
      "Lead-frame packages like QFN → flip-chip BGA, fan-out, 2.5D for AI & HPC",
      "Expanding fast: CoWoS plant broke ground in Douliu in Aug 2026 · 5 new buildings in Changhua from 2027",
      "Turnkey: bumping, wafer sort → assembly, final test, shipment",
    ],
  },
  {
    id: "newest",
    title: "SPIL's newest products",
    group: "Core",
    question: "What are SPIL's products, and what is the newest?",
    keys: "products newest cowos foeb packaging technology",
    target: [25, 45],
    cues: [
      "CoWoS-type 2.5D capacity for AI chips: Tanzi since 2025, Douliu from 2028",
      "FOEB, Fan-Out Embedded Bridge: SoC + HBM joined through small silicon bridges, not a full interposer",
      "Warpage control matters for large AI packages: a safe topic",
    ],
  },
  {
    id: "experience",
    title: "Job experience",
    group: "Core",
    question: "Tell us about your work experience.",
    keys: "work job experience team lead project internship",
    target: [45, 75],
    details: ["project-actions", "project-results", "project-mistake"],
    cues: [
      "S: the situation: project, client, goal",
      "T: your task, and the team size",
      "A: what YOU did",
      "R: the result, in numbers",
      "Ready for: what did YOU do? · what went wrong? · disagreement? · what would you change?",
    ],
  },
  {
    id: "problem-solved",
    title: "A problem you diagnosed",
    group: "Core",
    question: "Tell us about a problem you solved. How did you find the cause?",
    keys: "problem root cause debug troubleshoot challenge solved",
    target: [45, 75],
    details: ["root-cause"],
    cues: [
      "What looked wrong, and how big",
      "What I checked first · what I ruled out",
      "The cause · the fix · how I confirmed it",
      "Link: “When a number moves, I want to know why before I change anything.”",
    ],
  },
  {
    id: "why-pe",
    title: "Why this role?",
    group: "Core",
    question: "Why do you want to be a process engineer?",
    keys: "why process engineer role",
    target: [30, 60],
    cues: ["[What draws you to this work]", "[Which of your skills fit it]", "[What you want to learn first on the line]"],
  },
  {
    id: "why-spil",
    title: "Why SPIL?",
    group: "Core",
    question: "Why did you choose SPIL?",
    keys: "why spil choose our company first choice",
    target: [30, 50],
    cues: [
      "[Reason 1: something specific about SPIL that you found yourself]",
      "[Reason 2: how SPIL's direction fits your plans]",
      "[Reason 3: one of SPIL's values that matches how you work]",
      "Facts to draw on: the “What do you know about SPIL?” card. Pick your own reasons",
    ],
  },
  {
    id: "stress",
    title: "How do you cope with stress?",
    group: "Core",
    question: "How do you usually cope with stress?",
    keys: "stress pressure cope relax",
    target: [30, 60],
    details: ["stress"],
    cues: [
      "1 My real way, and how often",
      "2 I know the job: long hours in a cleanroom suit; abnormal lots come any time",
      "3 At work: break the problem into the next concrete step · regular routine & sleep · ask the team early",
      "4 SPIL: employee clubs, the recreation center",
    ],
  },
  {
    id: "overtime",
    title: "Overtime or shifts?",
    group: "Core",
    question: "Are you willing to work overtime or on shifts?",
    keys: "overtime shift night work hours",
    target: [25, 45],
    details: ["overtime"],
    cues: [
      "Yes: a line runs 24 hours and problems don't wait",
      "Overtime when the line needs me · shifts if the role requires it",
      "SPIL follows the RBA standard: ≤60 h/week incl. overtime, 1 day off in 7",
      "Work efficiently so overtime stays the exception",
      "Then ask: “What would this role's schedule be?”",
    ],
  },
  {
    id: "stay",
    title: "Stay in Taiwan? How long?",
    group: "Pre-hire",
    question: "Do you plan to stay in Taiwan, and for how long?",
    keys: "stay taiwan how long years future plan leave",
    target: [20, 40],
    details: ["stay-years"],
    cues: ["At least the two years after graduation that the program requires", "[Your long-term plan, honestly]", "I chose this role on purpose"],
  },
  {
    id: "after-grad",
    title: "Plan after graduation",
    group: "Pre-hire",
    question: "What is your plan after graduation?",
    keys: "after graduation future career goal five years",
    target: [20, 40],
    cues: ["Join SPIL full time, at the site where you need me", "In 3–5 years: own a process area and lead improvement projects", "Keep raising my Chinese"],
  },
  {
    id: "chinese-level",
    title: "Your Chinese level / TOCFL",
    group: "Pre-hire",
    question: "What is your Chinese level, and when will you take TOCFL?",
    keys: "chinese level mandarin tocfl language test",
    target: [20, 45],
    details: ["chinese-study", "tocfl-plan"],
    cues: ["[Your level · how you study · how often]", "Targets: [TOCFL level before arrival · later goals]", "Test: [month and place]"],
  },
  {
    id: "strengths",
    title: "Strengths & weaknesses",
    group: "Common",
    question: "What are your strengths and weaknesses?",
    keys: "strength weakness improve",
    target: [30, 60],
    details: ["weakness"],
    cues: [
      "Two sides of one coin: strength → the challenge it creates → how I'm improving → how it helps at work",
      "Strengths: [two]",
      "Weakness: [the other side of one strength] + [a real example]",
      "Improving: [what you do now]",
      "Never “I'm a perfectionist”",
    ],
  },
  {
    id: "different",
    title: "What makes you different?",
    group: "Common",
    question: "What makes you different from other candidates?",
    keys: "different unique special why hire you",
    target: [25, 45],
    details: ["different"],
    cues: ["[Your rare mix of skills or experience]", "[One moment that proves it]"],
  },
  {
    id: "taiwan",
    title: "What do you like about Taiwan?",
    group: "Common",
    question: "What do you like about Taiwan?",
    keys: "taiwan like food culture",
    target: [20, 40],
    details: ["taiwan-likes"],
    cues: ["Two specific, true things: not “everything” or “the people”", "Close: Taiwan is where the chip industry comes together; NCUE and SPIL are both in central Taiwan"],
  },
  {
    id: "achievement",
    title: "Greatest achievement / biggest challenge",
    group: "Common",
    question: "What is your greatest achievement, and your biggest challenge?",
    keys: "achievement proud challenge difficult setback failure",
    target: [40, 70],
    details: ["challenge"],
    cues: ["Achievement: [your best project], told with STAR", "Challenge: the setback → what I did → what I learned"],
  },
  {
    id: "little-exp",
    title: "Little work experience: why qualified?",
    group: "Common",
    question: "You have little work experience. Why are you qualified?",
    keys: "experience qualified junior fresh",
    target: [20, 40],
    details: ["quick-learning"],
    cues: ["[Your most real-world project]", "This program is built to train me, and I learn fast", "Quick-learning example"],
  },
  {
    id: "salary",
    title: "Salary expectations",
    group: "Common",
    question: "What are your salary expectations?",
    keys: "salary pay money expectation",
    target: [10, 25],
    cues: ["Wait for them to raise it", "“As a pre-hire student, I'll follow the standard package for the program.”", "“Right now my priority is learning and contributing.”"],
  },
  {
    id: "industry",
    title: "Taiwan's chip industry",
    group: "Common",
    question: "Why is Taiwan's semiconductor industry important, and where is it heading?",
    keys: "industry semiconductor taiwan trend future develop packaging market",
    target: [30, 60],
    cues: [
      "The whole chain in one place: chip design, wafer manufacturing, packaging and testing",
      "AI demand: output forecast NT$8.44 trillion in 2026, up 29.5% from NT$6.5 trillion",
      "Shrinking transistors is harder → gains come from packaging: chiplets, 2.5D/3D with HBM, fan-out",
      "2026: packaging NT$570.3 billion (+18.2%) · testing NT$267.7 billion (+17.1%)",
      "So the next years need many process engineers to bring new lines to stable yield",
    ],
  },
  {
    id: "pe-role",
    title: "What a SPIL process engineer does",
    group: "Reference",
    question: "What do you think a process engineer does at SPIL?",
    keys: "role job description responsibility daily work",
    target: [30, 60],
    cues: [
      "Own 1–2 assembly steps and keep them stable",
      "First engineering lots: confirm parameters; collect reflow profiles, X-ray and SAT scans",
      "Abnormal lots: disposition, failure & data analysis, corrective action",
      "Projects judged on QCDS: quality, cost, delivery, safety",
      "Floor work in a cleanroom suit · coordinate with equipment, quality, production and product engineers, mostly in Chinese",
    ],
  },
  {
    id: "case",
    title: "Case question: 6 steps",
    group: "Case",
    question: "Wire-bond yield dropped 2% this week. What do you do?",
    keys: "case problem yield drop what would you do scenario abnormal",
    target: [50, 80],
    cues: [
      "6 C's: Clarify → Contain → Compare → Cause → Correct → Copy across",
      "1 Clarify: which product, machine, lots? Since when? How big?",
      "2 Contain: hold suspect lots · follow the OCAP · tell my supervisor and QA",
      "3 Compare: good vs bad by machine, shift, material lot, recipe, time · SPC chart · check the measurement",
      "4 Cause: 5 Whys + fishbone 人機料法環 with the equipment engineer · confirm with a test lot",
      "5 Correct: one change at a time · watch SPC and yield on the next lots",
      "6 Copy across: update SOP/OCAP/FMEA · 8D if the customer saw it · same fix on similar machines (水平展開)",
      "Don't know the machine → “I'd check the BKM and ask the equipment engineer first, but my approach is…”",
    ],
    full: caseUniversal,
  },
  {
    id: "toolkit",
    title: "Process toolkit (SPC, Cpk, 8D)",
    group: "Reference",
    keys: "spc cpk cp control chart 8d fmea doe msa defects voids delamination warpage",
    cues: [
      "SPC: center line ± 3σ of the process's own data · control limits ≠ spec limits",
      "Signals: 1 point > 3σ · 2 of 3 > 2σ · 4 of 5 > 1σ · 8–9 in a row on one side · 6 rising or falling",
      "Cp = (USL − LSL) ÷ 6σ · Cpk = min(USL − μ, μ − LSL) ÷ 3σ · ≥ 1.33, 1.67 for critical",
      "8D: team · describe · contain · root cause · choose fix · implement & verify · prevent · close",
      "FMEA: severity × occurrence × detection = RPN · MSA/Gage R&R before trusting data",
    ],
  },
  {
    id: "tough-gap",
    title: "“Your background doesn't match this role”",
    group: "Tough",
    question: "Your background is different from this role. Why should we choose you?",
    keys: "gap background mismatch why you",
    target: [20, 45],
    cues: ["[The bridge from your background to this role, worded the same way every time]", "[One example that proves you can do the work]"],
  },
  {
    id: "tough-numbers",
    title: "“By how much?”",
    group: "Tough",
    question: "You say you improved it. By how much?",
    keys: "how much numbers results",
    target: [10, 30],
    details: ["research-status"],
    cues: ["One real number, or your honest stage", "Never invent a number"],
  },
  {
    id: "tough-degree",
    title: "“How do both degrees work?”",
    group: "Tough",
    question: "You're already in a master's program. How do both degrees work?",
    keys: "double degree two degrees credit transfer",
    target: [15, 40],
    details: ["double-degree"],
    cues: ["Credit transfer · thesis supervision · timeline"],
  },
  {
    id: "tough-leave",
    title: "“Won't you leave after two years?”",
    group: "Tough",
    question: "Won't you leave after two years?",
    keys: "leave two years commitment loyalty",
    target: [15, 35],
    details: ["stay-years"],
    cues: ["I chose this role on purpose", "I see my long-term career with the company"],
  },
  {
    id: "tough-operators",
    title: "“How will you work with operators in Chinese?”",
    group: "Tough",
    question: "How will you work with operators on the line in Chinese?",
    keys: "operators communicate chinese colleagues line",
    target: [20, 40],
    details: ["chinese-study"],
    cues: ["My study routine · TOCFL targets", "My Chinese self-introduction is the proof", "Line words: 製程 良率 異常 機台 參數"],
  },
  {
    id: "survival",
    title: "If they speak Chinese",
    group: "Phrases",
    keys: "chinese help sos don't understand 聽不懂 repeat",
    zhSet: "sos",
    cues: ["English: “Sorry, I've only just started learning Chinese. Could you ask me in English?”", "Smile, switch, never nod along"],
  },
  {
    id: "bridges",
    title: "Bridges",
    group: "Phrases",
    keys: "bridge think moment clarify repeat",
    cues: [
      "“That's a good question. Let me think for a second.”",
      "“Just to make sure I understand, are you asking about A or B?”",
      "“Could you please repeat the question?”",
      "“That connects to my [project], where …”",
      "“Yes, thank you. I have two short questions.”",
    ],
  },
  {
    id: "your-questions",
    title: "Your questions for SPIL",
    group: "Phrases",
    question: "Do you have any questions for us?",
    keys: "questions ask them any questions for us",
    target: [20, 60],
    details: ["my-questions"],
    cues: [
      "[Your first question, in your own words]",
      "[Your second question]",
      "Keep one or two in reserve, in case they're answered during the interview",
      "Don't raise salary or benefits",
    ],
  },
  {
    id: "closing",
    title: "Closing",
    group: "Phrases",
    keys: "closing goodbye thank you end",
    zhSet: "close",
    cues: ["“Thank you very much for your time today.”", "Then note what to improve"],
  },
];

// Cards offered as one-tap chips on the overlay's home view during "Their questions".
export const likelyCards = ["experience", "why-pe", "know-spil", "background", "research", "stress", "overtime", "stay", "chinese-level", "strengths", "why-spil", "case"];

// The case-question method: six steps that all start with C, so they're easy to remember under pressure.
export const caseSteps = ["Clarify", "Contain", "Compare", "Cause", "Correct", "Copy across"];

export const caseStepHelp: CaseStepHelp[] = [
  { step: "Clarify", say: "Ask before you solve: which product, machine and lots? Since when? How big?", words: "one machine or all? since when? how many lots?" },
  { step: "Contain", say: "Protect the customer first: hold suspect lots, follow the OCAP, tell your supervisor and QA.", words: "hold the lots · OCAP · supervisor + QA" },
  { step: "Compare", say: "Compare good and bad: machine, shift, material lot, recipe, time. Look at the SPC chart. Check the measurement is right.", words: "good vs bad · SPC · check the gauge" },
  { step: "Cause", say: "Find the root cause with 5 Whys and the fishbone (人機料法環), with the equipment engineer. Confirm it with a test lot.", words: "5 Whys · fishbone · test lot" },
  { step: "Correct", say: "Change one thing at a time, then watch SPC and yield on the next lots. If it doesn't hold, go back a step.", words: "one change · watch the next lots" },
  { step: "Copy across", say: "Prevent it coming back: update the SOP, OCAP and FMEA, write the 8D if the customer saw it, apply the fix to similar machines (水平展開).", words: "SOP · 8D · 水平展開" },
];

export const caseUnknown = "I don't know this machine yet, so I'd check the BKM and ask the equipment engineer first. But my approach would be the same: …";

export const casePrompts: CasePrompt[] = [
  {
    id: "wirebond",
    kind: "process",
    prompt: "Wire-bond yield dropped 2% this week. What do you do?",
    checkFirst: "One bonder or all, which product, since when; capillary change history, bond force and ultrasonic power logs, wire lot, last maintenance",
    model:
      "First I'd clarify: is it one bonder or all of them, one product or all, and when did it start? Say the data shows bonder 3 since Tuesday. To contain it, I'd hold the suspect lots, follow the OCAP, and tell my supervisor and QA. Then I'd compare bonder 3 with the good bonders: capillary change history, bond force and ultrasonic power logs, the wire lot, and the last maintenance. If the drop started right after a capillary change, that's my first suspect for the cause, and I'd confirm it with a test lot. To correct it, I'd reset or replace the capillary, then watch ball shear and yield on the SPC chart for the next lots. Finally I'd copy the fix across: update the maintenance checklist and check the other bonders using the same capillary lot.",
  },
  {
    id: "qualification",
    kind: "process",
    prompt: "A new machine fails its qualification run. What do you do?",
    checkFirst: "Which items failed and by how much; recipe vs the BKM and a good machine, calibration, tooling, material lot; the equipment engineer",
    model:
      "First I'd clarify which items failed, for example bond strength, placement accuracy, or a Cpk below 1.33, and by how much. To contain it, I wouldn't release the machine to production; the line keeps running on the qualified machines. Then I'd compare the new machine with a good one: the recipe and parameters against the BKM, calibration, tooling, and the material lot used for the run. I'd find the cause together with the equipment engineer, because they know the machine best. After correcting it, for example a calibration offset, I'd run another qualification lot and check that the Cpk passes. Then I'd copy it across: add the check to the qualification checklist and check the other new machines from the same delivery.",
  },
  {
    id: "own-mistake",
    kind: "people",
    prompt: "You find out that a mistake you made has affected some production lots. What do you do?",
    checkFirst: "Tell your supervisor at once, with facts; hold the affected lots; find why your check missed it; fix with QA; add a check so it can't happen again",
    model:
      "First I'd tell my supervisor right away, honestly, with the facts: what happened and which lots could be affected. Then I'd contain it: hold those lots so nothing bad reaches the customer. Next I'd find the cause: why did my check miss it? Was a step missing from the procedure, or was I rushing? Then I'd work with QA to correct the affected lots. Finally I'd prevent it from happening again, for example by adding a checklist step, and share what I learned so others don't make the same mistake.",
  },
];

// What the panel has read in your application, for the AI interviewer. Keep it factual.
export const packet = `Candidate: [full name] ("[first name]"), [nationality].
Education: [degrees, universities, GPA].
Experience: [jobs, internships, projects, with your role and results].
Language: [Chinese level and how you study]; targets [TOCFL levels].
Plan: [program] (study in Taiwan, intern in Year 2, then work in Taiwan at least 2 years).
Gaps the panel may probe: [anything in your application that doesn't obviously fit the role].`;

export const roleFacts = `SPIL: Taichung-based outsourced semiconductor assembly and test (OSAT, 封測), founded 1984, about 25,000 employees, part of ASE since 2018, now wholly owned by ASE Technology Holding. Turnkey from bumping and wafer sort to assembly, final test and shipment. Packages: QFN, PBGA, TFBGA, stacked-die CSP, WLCSP, FCBGA, fan-out, CoWoS-type 2.5D, FOEB. Expanding: Douliu CoWoS plant (ground broken Aug 2026, phase 1 Feb 2028), five new buildings at the Changhua compound from 2027. No-Compromise Policy on quality, safety and legal compliance. RBA labor standard (max 60 h/week including overtime, one day off in seven). Benefits: recreation center with gym, clubs, dining with meal subsidies and vegetarian options, dormitories, shuttle buses. New engineers get structured onboarding and a training blueprint.
Process engineer: owns one or two assembly steps; first engineering lots (confirm parameters, collect reflow profiles, X-ray and SAT data); abnormal lots (disposition, failure and data analysis, corrective action); projects judged on QCDS; DOE in JMP, BKM rollout, qualification lots, machine alarms; cleanroom floor work; coordinates with equipment, quality, production and product engineers, mostly in Chinese. Some process roles run 12-hour shifts. Year-2 interns: both semesters at SPIL, Fridays in the NCUE lab, paid at least minimum wage.`;

// How the AI interviewer and coach talk about this interview.
export const coaching: Coaching = {
  interviewer:
    "an interviewer from SPIL (Siliconware Precision Industries, 矽品精密, part of ASE): a Taiwanese process-engineering manager on a panel interviewing an international student for SPIL's pre-hire track in the NCUE INTENSE Program. The call is on Google Meet and mainly in English. Your English is clear, simple and a little formal, the way a Taiwanese manager speaks English as a second language. You are polite but busy, and you want concrete evidence.",
  context: "a 15-minute SPIL Process Engineer pre-hire interview (NCUE INTENSE Program), held in English on Google Meet",
  callName: "", // your first name, e.g. "Alex"
  greeting: `It's morning in Taiwan: greet with "Good morning".`,
  chineseQuestions: ["你為什麼想來台灣工作？", "你現在住在哪裡？"],
  rules: ['say SPIL as one word ("spill")'],
};
