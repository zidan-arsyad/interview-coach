# Interview Coach

A practice app for job interviews in Taiwan (made for the NCUE INTENSE Program company interviews),
plus live cue cards during the interview. It runs on your own computer, in your browser.

- **Chinese drill**: your Chinese self-introduction line by line, with a Taiwan voice and a check of
  each syllable and tone.
- **English practice**: your intro, slides, likely questions and case prompts, timed (length, pace,
  pauses), with AI feedback and a tighter version you can listen to.
- **Case questions**: the 6 C's method (Clarify, Contain, Compare, Cause, Correct, Copy across) with
  worked examples.
- **Mock interview**: a spoken interview with an AI interviewer that asks follow-ups, then a scorecard.
- **Quick-fire**: flashcards for company facts, industry numbers, the process toolkit, vocabulary.
- **Interview day**: an always-on-top cue overlay that floats over Google Meet, plus a checklist.

The example content is for a **SPIL Process Engineer** interview. You can change everything.

## What you need

- **Node.js 24 LTS or newer**: download the LTS installer from https://nodejs.org and install it with
  the default options.
- **Chrome** (recommended) or **Edge**. Firefox works for most pages, but it has no speech
  recognition of its own (add a Groq key, below) and can't keep the overlay on top.
- A **microphone**, and **headphones** for the mock interview, so the AI's voice doesn't leak into
  your microphone.
- An internet connection.

## 1. Get the app

- **Easiest:** on this GitHub page, click **Code → Download ZIP** and unzip it somewhere you'll find
  it again, for example `Documents\interview-coach`.
- **With git:** `git clone https://github.com/zidan-arsyad/interview-coach.git`

## 2. Start it

- **Windows:** double-click **`Start Interview Coach.bat`**. The first time, it installs what it needs
  (about a minute). A black window opens (that *is* the app), and then Chrome opens
  http://localhost:5179.
- **macOS / Linux:** in the folder, run `npm install` once, then `npm start`, and open
  http://localhost:5179.

Keep the black window open while you practise. **To stop**, close it (or press Ctrl+C in it).

The first start creates two private things for you, which are never uploaded or shared:

- `profile/`: your content (intro, cue cards, Chinese lines, your details)
- `.env`: your API keys

## 3. Add a key (5 minutes)

Open **`.env`** in the app folder with Notepad (right-click → Open with → Notepad) and paste keys
after the `=` signs, without spaces or quotes. Save the file: the app picks it up within a few
seconds, no restart needed.

| Key | What it does | How to get it |
|---|---|---|
| `GROQ_API_KEY` (**recommended**, free, no card) | Speech recognition in any browser, and the fast AI for the mock interviewer and feedback | Sign up or sign in at https://console.groq.com → **API Keys** → **Create API Key** → copy it |
| `GEMINI_API_KEY` (optional, free) | Backup AI when Groq is busy | https://aistudio.google.com → **Get API key** → **Create API key** |
| `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION` (optional) | Real pronunciation scores and neural voices | An Azure "Speech" resource, free F0 tier → **Keys and Endpoint** (needs an Azure account) |

Then, on the app's **Home** page, click **Test my setup**: it checks speech recognition, the voices
and the AI.

**Without any key**, Chrome's built-in speech recognition and voices still work. The mock interview
then uses a fixed list of questions with no follow-ups, and there's no AI feedback.

Never paste your keys into chats or share `.env`.

## 4. Make it yours

Open the files in **`profile/`** with a text editor. [VS Code](https://code.visualstudio.com) is
easiest; Notepad works too. Replace every **`[bracket]`** with your own words. The example gives
the structure only; your introduction, reasons and questions should be yours, because panels
notice when candidates sound the same. Work in this order:

1. **Your details**: use the app's **My details** page, or edit `profile/my-details.md` (plain text).
   Real numbers and stories: your best project, results, a mistake you learned from, how you cope
   with stress. The AI interviewer asks follow-ups about these, and the overlay shows them.
2. **`profile/interview.ts`**: the main file:
   - `interview`: company, role, your interview **date and start time** (in Taiwan time), and time
     zones. The date and time can also be set on the Interview day page.
   - `messages`: your three key messages; `pitch`: one sentence about you.
   - `introEnglish` and `slides`: your English introduction and slide talking points.
   - `packet`: what the panel knows about you (your CV in a few lines), for the AI interviewer.
   - `coaching.callName`: your first name, so the AI interviewer calls you by it.
   - `cards`: the cue cards. The example's prompts already work as a structure, so personalize the
     cues of the cards you care about most.
3. **`profile/zh.ts`**: your Chinese introduction, one line per sentence, with pinyin.
4. Optional: `casePrompts` (in `interview.ts`) and the quick-fire decks in `profile/quick.ts`.

**Editing tips:**

- Change only the text **inside the quotes** `"…"`, and keep the commas, brackets and braces.
- Save, then refresh the browser: the app rebuilds by itself. If the page goes blank or stops
  updating, look at the black window. It shows the error, usually a missing quote or comma.
- Chinese lines need **one pinyin syllable per character** (with tone marks, e.g. `wǒ jiào`).
  English words inside a Chinese line (your name, `AI`) are copied into the pinyin as they are.
- To check your Chinese lines and card references: open a terminal in the app folder (on Windows,
  click the folder's address bar, type `cmd` and press Enter) and run `npm run test:content`.
- **Start over:** delete the `profile/` folder. The next start makes a fresh copy of the example.

The example is set up for SPIL. For another company, also change the company facts (`know-spil`,
`newest`, `why-spil` cards and `roleFacts`), the case prompts, and `coaching` (who the AI
interviewer pretends to be).

## 5. Practise

A good order, the day before:

1. **Chinese drill**: get every line of your introduction to 80+, then one full run.
   `Space` record/stop · `L` listen · `S` slow · `P` play your take · `←` `→` lines. Each line also has
   a **Google Translate** button to hear it.
2. **English practice**: two timed runs of your introduction (under 1:45), then the likely
   questions. `Space` record/stop · `Q` hear the question · `C` cues on/off.
3. **Case questions**: learn the 6 C's, say the universal answer out loud three times, then answer
   two examples yourself.
4. **Mock interview** (with headphones) twice: fix the top three points from each scorecard.
   `Space` starts and finishes your answer · `R` repeats the question.
5. **Quick-fire**: company facts and the process toolkit. `Space` shows the answer · `→` got it ·
   `←` missed.

Allow the microphone when the browser asks.

## 6. On interview day

1. Start the app, open http://localhost:5179 **in Chrome or Edge**, go to **Interview day** and check
   your slot.
2. Click **Open the overlay** and drag it to just under your webcam, so looking at it still looks
   like eye contact. Your meeting can run in any browser: the overlay floats above every window.
3. In the overlay: type a word (`stress`, `why`, `case`) and press `Enter` to open a card · `1`–`6`
   quick cards (中文 SOS, bridges, your questions, closing, slides, 中文 intro) · `Esc` or `0` back to
   the plan · **Start now** if the interview starts late.
4. When you share slides, share the slideshow **window**, not your whole screen.
5. **Close the overlay** with ✕ on it, the "Close the overlay" button, or by closing the tab.

The cues are keywords, not scripts: reading full sentences shows on camera.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Node.js is not installed" | Install the LTS version from https://nodejs.org, then start again |
| "Can't reach the Interview Coach server" | The black window was closed: double-click `Start Interview Coach.bat` again |
| "Interview Coach is already running" | It's already open: go to http://localhost:5179 |
| No speech recognition / "Firefox doesn't" | Use Chrome, or add a `GROQ_API_KEY` to `.env` |
| The microphone doesn't work | Click the camera/microphone icon in the address bar and allow it; check Windows sound settings |
| "No Chinese voice" | Use Chrome or Edge, or the Google Translate button on each line |
| AI is slow or says "limit reached" | Free tiers are busy at times: wait a minute. Adding both Groq and Gemini keys helps |
| The overlay isn't on top | Open it from Chrome or Edge (Firefox can't keep windows on top) |
| Page blank after editing `profile/` | Look at the black window for the error, fix the quote or comma, save, refresh |

## Privacy

- Your recordings and transcripts go to **Groq** for speech recognition, or to Google if you use
  Chrome's built-in recognition, and to **Azure** if you set it up.
- Your answers, your profile and your details go to **Groq** (or **Gemini** as the backup) for the
  interviewer and feedback. On Gemini's free tier, Google may use what you send to improve its
  models. Each service's own terms apply.
- Nothing is uploaded anywhere else. `profile/`, `.env` and `sessions/` (your saved mock interviews)
  stay on your computer and are excluded from git.

## Updating

- **If you used git:** run `git pull`, then start the app as usual (it installs any new
  dependencies itself).
- **If you downloaded the ZIP:** download it again and copy your `profile/` folder and `.env` into the
  new folder.

## For developers

- `npm run check`: type-check · `npm run test:content`: check both profiles
- `server/`: a small Node server (static files, and proxies to Groq, Gemini and Azure that keep the keys
  server-side) · `src/`: the React app · `profile.example/`: the template copied to `profile/`
