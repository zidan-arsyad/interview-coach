// EXAMPLE Chinese lines. Pinyin is one syllable per character, in Taiwan readings, with 不/一 tone
// changes applied. Latin words (a name, AI) appear in the pinyin exactly as in the characters.
// After editing, run `npm run test:content` to check the pinyin lines up.
import type { ZhSet } from "../src/content/types.ts";

export const zhSets: ZhSet[] = [
  {
    id: "intro",
    title: "Chinese self-introduction",
    note: "Only a format example. Write your own introduction in your own words, ideally checked by a teacher or a Chinese-speaking friend.",
    fullRunSeconds: 15,
    lines: [
      { id: "intro-1", zh: "大家好！", py: "dà jiā hǎo", en: "Hello, everyone!" },
      { id: "intro-2", zh: "我叫 Alex。", py: "wǒ jiào Alex", en: "My name is Alex.", tip: "Put your own name here." },
      { id: "intro-3", zh: "很高興認識大家。", py: "hěn gāo xìng rèn shì dà jiā", en: "Nice to meet you all." },
      { id: "intro-4", zh: "謝謝！", py: "xiè xie", en: "Thank you!" },
    ],
  },
  {
    id: "sos",
    title: "If they speak Chinese to you",
    note: "Use it right away, with a smile. Never nod along as if you understood.",
    lines: [
      {
        id: "sos-1",
        zh: "不好意思，我剛開始學中文，還聽不懂。可以請您用英文問嗎？",
        py: "bù hǎo yì si wǒ gāng kāi shǐ xué zhōng wén hái tīng bù dǒng kě yǐ qǐng nín yòng yīng wén wèn ma",
        en: "Sorry, I've just started learning Chinese and can't understand yet. Could you please ask in English?",
        tip: "Afterwards, continue in English.",
      },
      { id: "sos-2", zh: "不好意思，聽不懂。", py: "bù hǎo yì si tīng bù dǒng", en: "Sorry, I don't understand. (short backup)" },
      {
        id: "sos-3",
        zh: "不好意思，可以請您再說一次嗎？",
        py: "bù hǎo yì si kě yǐ qǐng nín zài shuō yí cì ma",
        en: "Sorry, could you please say that again?",
      },
    ],
  },
  {
    id: "close",
    title: "Closing lines",
    note: "Examples: choose your own closing.",
    lines: [
      { id: "close-1", zh: "謝謝您的時間。", py: "xiè xie nín de shí jiān", en: "Thank you for your time." },
      { id: "close-2", zh: "再見！", py: "zài jiàn", en: "Goodbye!" },
    ],
  },
  {
    id: "vocab",
    title: "Words you'll hear on the line",
    lines: [
      { id: "vocab-1", zh: "製程", py: "zhì chéng", en: "process" },
      { id: "vocab-2", zh: "良率", py: "liáng lǜ", en: "yield", tip: "lǜ: round your lips for ü." },
      { id: "vocab-3", zh: "異常", py: "yì cháng", en: "abnormality, abnormal lot" },
      { id: "vocab-4", zh: "機台", py: "jī tái", en: "machine, tool" },
      { id: "vocab-5", zh: "參數", py: "cān shù", en: "parameter" },
      { id: "vocab-6", zh: "工程批", py: "gōng chéng pī", en: "engineering lot" },
      { id: "vocab-7", zh: "封裝", py: "fēng zhuāng", en: "packaging" },
      { id: "vocab-8", zh: "測試", py: "cè shì", en: "testing" },
      { id: "vocab-9", zh: "無塵室", py: "wú chén shì", en: "cleanroom" },
      { id: "vocab-10", zh: "交接", py: "jiāo jiē", en: "shift handover" },
      { id: "vocab-11", zh: "加班", py: "jiā bān", en: "overtime" },
      { id: "vocab-12", zh: "輪班", py: "lún bān", en: "shift work" },
    ],
  },
];
