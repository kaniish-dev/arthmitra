import { CARE_NOTE, DISCLAIMER, type CoachAnswer } from "@arthmitra/schema";
import type { FlowCheck, FlowCheckId } from "./flow";
import { formatINR, toPaise } from "./money";
import { CUSHION_MONTHS, cushionMonths, cushionTarget, freeBalance, planForMoney, type Allocation, type EmergencyPlan, type MoneyStructure, type NextStep } from "./plan";

/**
 * Template coach used when AI is off or unavailable. It only restates figures the engine
 * computed and only offers buttons from COACH_ACTIONS — the same rules the Gemini coach
 * follows (see coach-prompt.ts).
 */
export type CoachIntent =
  | "crisis"
  | "medical"
  | "product"
  | "emergency"
  | "money_back"
  | "lent"
  | "rewards"
  | "safety"
  | "next_steps"
  | "stress"
  | "fun_budget"
  | "what_cut"
  | "reach_goal"
  | "how_much_save"
  | "where_money"
  | "unknown";
export type CoachLang = "en" | "hi";

export const DISCLAIMER_HI = "यह शैक्षिक मार्गदर्शन है, वित्तीय सलाह नहीं।";
export const CARE_NOTE_HI = "ArthMitra कोई चिकित्सा या आपातकालीन सेवा नहीं है।";
/** India's national tele mental health helpline (free, 24×7). */
export const TELE_MANAS = { short: "14416", long: "1-800-891-4416" } as const;
/** National cyber crime helpline, for money taken by fraud. */
export const CYBER_HELPLINE = "1930";

/** The only buttons a coach answer can carry. */
export const COACH_ACTIONS = {
  emergency: { href: "/emergency", icon: "emergency_home", en: "Emergency plan", hi: "इमरजेंसी प्लान" },
  lent: { href: "/lent", icon: "handshake", en: "Lent money", hi: "उधार" },
  goal: { href: "/goal", icon: "flag", en: "Goal plan", hi: "लक्ष्य योजना" },
  bills: { href: "/bills", icon: "event_repeat", en: "Bills", hi: "बिल" },
  inbox: { href: "/inbox", icon: "inbox", en: "Inbox", hi: "इनबॉक्स" },
  insights: { href: "/insights", icon: "insights", en: "Budgets", hi: "बजट" },
  rewards: { href: "/rewards", icon: "military_tech", en: "Rewards", hi: "इनाम" },
  accounts: { href: "/accounts", icon: "account_balance", en: "Bank consents", hi: "बैंक सहमति" },
} as const;
export type CoachActionId = keyof typeof COACH_ACTIONS;

export interface CoachSnapshot {
  monthLabel: string;
  incomePaise: number;
  spendingPaise: number;
  topCategories: Array<{ name: string; paise: number }>;
  capacityPaise: number;
  goal: {
    name: string;
    requiredPaise: number;
    contributionPaise: number;
    onTrack: boolean;
    gapPaise: number;
    /** Contribution beyond what the goal needs; 0 when behind. */
    sparePaise: number;
    targetDateLabel: string;
    projectedDateLabel: string | null;
  } | null;
  cuts: Array<{ category: string; name: string; roomPaise: number }>;
  cutsTotalPaise: number;
  /** Entertainment this month against its limit or estimate; null when there is neither. */
  fun: { budgetPaise: number; spentPaise: number; leftPaise: number; overPaise: number } | null;
  structure: MoneyStructure;
  lent: {
    outstandingPaise: number;
    people: Array<{ person: string; outstandingPaise: number; dueLabel: string | null; overdue: boolean }>;
    /** The latest money paid back in the last 30 days, with where the engine says it should go. */
    lastReturn: { person: string; amountPaise: number; dateLabel: string; plan: Allocation[] } | null;
  };
  /** The engine's next steps, most urgent first. */
  steps: NextStep[];
  flow: { checks: FlowCheck[]; score: number; streak: number; level: string; nextLevel: string | null; monthsToNext: number };
  emergency: EmergencyPlan & { mode: boolean };
}

export type CoachReply = CoachAnswer & { intent: CoachIntent };

type Suggested = { intent: CoachIntent; text: string; group: "plan" | "money" };
export const SUGGESTED_QUESTIONS: Record<CoachLang, Suggested[]> = {
  en: [
    { intent: "next_steps", text: "What should I do now?", group: "plan" },
    { intent: "money_back", text: "Money came back — where should it go?", group: "plan" },
    { intent: "lent", text: "Who still owes me money?", group: "plan" },
    { intent: "safety", text: "Am I safe if something goes wrong?", group: "plan" },
    { intent: "rewards", text: "What do I get for a perfect month?", group: "plan" },
    { intent: "emergency", text: "I have an emergency — what do I do?", group: "plan" },
    { intent: "where_money", text: "Where did my money go this month?", group: "money" },
    { intent: "how_much_save", text: "How much can I save each month?", group: "money" },
    { intent: "reach_goal", text: "Will I reach my goal on time?", group: "money" },
    { intent: "what_cut", text: "What can I cut to catch up?", group: "money" },
  ],
  hi: [
    { intent: "next_steps", text: "अब मुझे क्या करना चाहिए?", group: "plan" },
    { intent: "money_back", text: "पैसे वापस आए — इनका क्या करूँ?", group: "plan" },
    { intent: "lent", text: "मेरे पैसे किस-किस पर बाकी हैं?", group: "plan" },
    { intent: "safety", text: "कुछ गलत हुआ तो क्या मैं सुरक्षित हूँ?", group: "plan" },
    { intent: "rewards", text: "पूरा महीना सही चला तो क्या मिलेगा?", group: "plan" },
    { intent: "emergency", text: "इमरजेंसी है — क्या करूँ?", group: "plan" },
    { intent: "where_money", text: "इस महीने मेरा पैसा कहाँ गया?", group: "money" },
    { intent: "how_much_save", text: "मैं हर महीने कितना बचा सकता हूँ?", group: "money" },
    { intent: "reach_goal", text: "क्या मैं अपना लक्ष्य समय पर पूरा करूँगा?", group: "money" },
    { intent: "what_cut", text: "मैं कहाँ खर्च कम करूँ?", group: "money" },
  ],
};

// Safety intents are checked first, then the most specific wording.
const CRISIS =
  /suicid|kill myself|end my life|end it all|want to die|wanna die|self[- ]?harm|hurt myself|no reason to live|आत्महत्या|खुदकुशी|ख़ुदकुशी|मरना चाहत|जीना नहीं चाहत|marna chahta|khudkushi/i;
const MEDICAL =
  /\b(medicines?|medication|tablets?|dose|dosage|symptoms?|diagnos\w*|disease|fever|pain|cure|treatment|blood pressure|diabet\w*)\b|दवा|बुखार|दर्द|बीमारी|इलाज/i;
const PRODUCT =
  /\b(which|what|best|good|top|recommend)\b.*\b(funds?|stocks?|shares?|policy|policies|insurance|crypto|coins?)\b|\bcrypto|\binsurance\b|बीमा|कौन\s?सा (फ़ंड|फंड|शेयर)/i;

const INTENT_PATTERNS: Array<[CoachIntent, RegExp]> = [
  ["emergency", /emergenc(?!y\s+fund)|urgent|lost my job|job loss|hospital|इमरजेंसी|आपात|achanak|अचानक|naukri chali|job chali|job gayi|नौकरी चली/i],
  ["money_back", /came back|\bgot\b.{0,25}\bback\b|returned|paid me back|money back|वापस|wapas|lauta|लौटा/i],
  ["lent", /\bowes?\b|\blent\b|\blend|udhaa?r|उधार|बाकी|baaki|borrow/i],
  ["rewards", /reward|points?\b|badge|perfect month|good month|level|इनाम|पॉइंट|क्या मिलेगा/i],
  ["safety", /\bsafe|safety|protect|scam|fraud|सुरक्षा|सुरक्षित|धोखा|फ्रॉड/i],
  ["next_steps", /what should i do|what do i do|what next|next step|kya karu|kya karna|क्या करूँ|क्या करना चाहिए|सलाह/i],
  ["stress", /stress|worr(y|ied)|anxious|tension|overwhelm|pressure|चिंता|तनाव|टेंशन|परेशान|pareshan/i],
  ["fun_budget", /\bfun\b|enjoy|\btreats?\b|मज़|मजे|मजा|masti|मस्ती/i],
  ["what_cut", /cut|reduce|\bkam\b|कम|catch up/i],
  ["reach_goal", /goal|reach|on time|lakshya|लक्ष्य|pura|पूरा/i],
  ["how_much_save", /save|saving|bacha|bachat|बचा|बचत/i],
  ["where_money", /where|spent|spend|kahan|kaha|kharch|कहाँ|खर्च|पैसा/i],
];

export function detectIntent(question: string): CoachIntent {
  if (CRISIS.test(question)) return "crisis";
  if (MEDICAL.test(question)) return "medical";
  if (PRODUCT.test(question)) return "product";
  for (const [intent, pattern] of INTENT_PATTERNS) if (pattern.test(question)) return intent;
  return "unknown";
}

/** A rupee amount typed in a question ("I got 5,000 back", "₹1200"); ₹100 or more, else null. */
export function amountInQuestion(question: string): number | null {
  const m = /(?:₹|rs\.?|inr)?\s?(\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d{1,2})?/i.exec(question);
  if (!m) return null;
  try {
    const paise = toPaise(m[0].replace(/^(₹|rs\.?|inr)/i, ""));
    return paise >= 10_000 ? paise : null;
  } catch {
    return null;
  }
}

const inr = (p: number) => formatINR(p);

const FLOW_NAMES: Record<FlowCheckId, { en: string; hi: string }> = {
  sorted: { en: "sort every payment", hi: "हर खर्च छाँटना" },
  budgets: { en: "stay within every budget", hi: "हर बजट में रहना" },
  saved: { en: "save for your goal", hi: "लक्ष्य के लिए बचत" },
  lent: { en: "no lent money overdue", hi: "कोई उधार समय से पीछे नहीं" },
};

function allocationLines(plan: Allocation[], s: CoachSnapshot, lang: CoachLang): string[] {
  const hi = lang === "hi";
  const months = cushionMonths(s.structure);
  return plan.map((a) => {
    const x = inr(a.paise);
    switch (a.kind) {
      case "bills":
        return hi ? `${x} अगले 10 दिन के बिलों के लिए रखें` : `keep ${x} for bills due in the next 10 days`;
      case "cushion":
        return hi
          ? `${x} इमरजेंसी कुशन में डालें (अभी ${months ?? 0} महीने का ज़रूरी खर्च है, लक्ष्य ${CUSHION_MONTHS})`
          : `put ${x} in your emergency cushion (${months ?? 0} months of essentials now, aim for ${CUSHION_MONTHS})`;
      case "goal": {
        const gap = s.goal && !s.goal.onTrack ? s.goal.gapPaise : 0;
        const covered = gap > 0 ? Math.floor(a.paise / gap) : 0;
        const extra =
          covered >= 1
            ? hi
              ? ` — यह ${covered} महीने की कमी पूरी करता है`
              : ` — that covers ${covered} ${covered === 1 ? "month" : "months"} of your gap`
            : "";
        return hi ? `${x} ${s.structure.goalName} के लिए${extra}` : `put ${x} toward ${s.structure.goalName}${extra}`;
      }
      case "you":
        return hi ? `${x} अपने लिए रखें` : `keep ${x} for yourself`;
    }
  });
}

function joinLines(lines: string[], lang: CoachLang): string {
  if (lines.length <= 1) return lines.join("");
  if (lang === "hi") return `${lines.slice(0, -1).join("; ")} और ${lines.at(-1)}`;
  return lines.length === 2 ? `${lines[0]} and ${lines[1]}` : `${lines.slice(0, -1).join("; ")}; and ${lines.at(-1)}`;
}

export function templateAnswer(intent: CoachIntent, s: CoachSnapshot, lang: CoachLang, question = ""): CoachReply {
  const hi = lang === "hi";
  const top = s.topCategories.slice(0, 3);
  const topText = top.map((c) => `${c.name} ${inr(c.paise)}`).join(", ");
  const figures: string[] = [];
  let actionIds: CoachActionId[] = [];
  let disclaimer = hi ? DISCLAIMER_HI : DISCLAIMER;
  let answer: string;

  switch (intent) {
    case "crisis":
      disclaimer = hi ? CARE_NOTE_HI : CARE_NOTE;
      answer = hi
        ? `मुझे बहुत दुख है कि आप ऐसा महसूस कर रहे हैं। आपको यह अकेले नहीं सहना है। कृपया टेली-मानस को ${TELE_MANAS.short} या ${TELE_MANAS.long} पर कॉल करें — यह मुफ़्त है, 24×7 खुला है और आप अपनी भाषा में बात कर सकते हैं। अगर अभी ख़तरा है, तो 112 पर कॉल करें। हो सके तो किसी भरोसेमंद व्यक्ति को अभी बताएँ।`
        : `I'm really sorry you're feeling this way. You don't have to carry this alone. Please call Tele-MANAS on ${TELE_MANAS.short} or ${TELE_MANAS.long} — it's free, open 24×7, and you can talk in your own language. If you're in danger right now, call 112. If you can, tell someone you trust what's going on.`;
      break;
    case "medical":
      disclaimer = hi ? CARE_NOTE_HI : CARE_NOTE;
      answer = hi
        ? "मैं लक्षण, दवा या इलाज जैसे सवालों में मदद नहीं कर सकता — कृपया डॉक्टर से पूछें। मैं सेहत के खर्च की योजना और इमरजेंसी के लिए पैसे अलग रखने में मदद कर सकता हूँ।"
        : "I can't help with medical questions like symptoms, medicines or treatment — please ask a doctor. I can help you plan for health costs and keep money aside for emergencies.";
      actionIds = ["emergency"];
      break;
    case "product":
      answer = hi
        ? "मैं कोई ख़ास फ़ंड, शेयर, पॉलिसी या ऐप नहीं सुझा सकता। आपके Goal पेज पर आपकी समय-सीमा के हिसाब से विकल्पों के सामान्य प्रकार हैं, और SEBI-पंजीकृत निवेश सलाहकार आपको निजी सलाह दे सकते हैं।"
        : "I can't recommend a specific fund, stock, policy or app. Your Goal page shows the general types of options that suit your time frame, and a SEBI-registered investment adviser can give you personal advice.";
      actionIds = ["goal"];
      break;

    case "next_steps": {
      if (!s.steps.length) {
        answer = hi
          ? "अभी सब ठीक चल रहा है — कुछ ज़रूरी नहीं है। खर्च छाँटते रहें और हर महीने अपने लक्ष्य के लिए बचत करें।"
          : "You're on top of things — nothing needs you right now. Keep sorting payments and saving for your goal each month.";
        break;
      }
      figures.push(...s.steps.flatMap((st) => st.figures));
      const list = s.steps.map((st, n) => `${n + 1}) ${st.title[lang]} — ${st.detail[lang]}`).join(hi ? "। " : ". ");
      answer = hi ? `मैं आगे यह करूँगा: ${list}।` : `Here's what I'd do next: ${list}.`;
      actionIds = [...new Set(s.steps.map((st) => st.action))];
      break;
    }

    case "money_back": {
      const typed = amountInQuestion(question);
      const last = s.lent.lastReturn;
      if (typed === null && !last) {
        answer = hi
          ? "बताइए कितने पैसे वापस आए, जैसे “₹5,000 वापस आए”, और मैं बताऊँगा कि उन्हें कहाँ लगाना है। उधार दिया हो तो उसे Lent money में दर्ज करें ताकि वापसी अपने-आप पहचानी जाए।"
          : "Tell me how much came back, like “I got ₹5,000 back”, and I'll show where it should go. If you lent it, record it in Lent money so the payback is spotted automatically.";
        actionIds = ["lent"];
        break;
      }
      const amount = typed ?? last!.amountPaise;
      const plan = typed !== null ? planForMoney(typed, s.structure) : last!.plan;
      figures.push(inr(amount), ...plan.map((a) => inr(a.paise)));
      const from = typed === null && last ? (hi ? ` ${last.person} से` : ` from ${last.person}`) : "";
      const lines = joinLines(allocationLines(plan, s, lang), lang);
      const months = cushionMonths(s.structure);
      const full =
        months !== null && months >= CUSHION_MONTHS && !plan.some((a) => a.kind === "cushion")
          ? hi
            ? ` आपका इमरजेंसी कुशन पहले से भरा है (${months} महीने)।`
            : ` Your emergency cushion is already full (${months} months of essentials).`
          : "";
      answer = hi
        ? `${inr(amount)}${from} — आपके बैलेंस, बिलों और योजना के हिसाब से: ${lines}।${full} पैसा अपने बैंक ऐप में खुद भेजें — ArthMitra पैसे नहीं भेजता।`
        : `${inr(amount)}${from} — based on your balance, bills and plan: ${lines}.${full} Move it yourself in your bank app; ArthMitra never moves money.`;
      actionIds = plan.some((a) => a.kind === "cushion") ? ["emergency"] : [];
      if (plan.some((a) => a.kind === "goal")) actionIds.push("goal");
      break;
    }

    case "lent": {
      const people = s.lent.people;
      actionIds = ["lent"];
      if (!people.length) {
        answer = hi
          ? "अभी किसी पर आपके पैसे बाकी नहीं हैं। उधार देने से पहले तय करें कि कितना खो सकते हैं, और लौटाने की तारीख तय करें।"
          : "Nobody owes you money right now. Before you lend, decide how much you could afford to lose, and agree a date to get it back.";
        break;
      }
      figures.push(inr(s.lent.outstandingPaise), ...people.map((p) => inr(p.outstandingPaise)));
      const list = people
        .slice(0, 4)
        .map((p) =>
          hi
            ? `${p.person} ${inr(p.outstandingPaise)}${p.dueLabel ? (p.overdue ? ` (तारीख ${p.dueLabel} निकल गई)` : ` (${p.dueLabel} तक)`) : ""}`
            : `${p.person} ${inr(p.outstandingPaise)}${p.dueLabel ? (p.overdue ? ` (overdue since ${p.dueLabel})` : ` (due ${p.dueLabel})`) : ""}`,
        )
        .join(", ");
      const overdue = people.some((p) => p.overdue);
      answer = hi
        ? `${people.length} लोगों पर कुल ${inr(s.lent.outstandingPaise)} बाकी हैं: ${list}।${overdue ? " तय तारीख पर एक दोस्ताना याद दिलाना अक्सर काम करता है — Lent money पेज पर संदेश तैयार है।" : ""} उतना ही उधार दें जितना खोना सह सकें।`
        : `${people.length === 1 ? "1 person owes" : `${people.length} people owe`} you ${inr(s.lent.outstandingPaise)}: ${list}.${overdue ? " A friendly reminder usually works — the Lent money page has one ready to send." : ""} Lend only what you could afford to lose.`;
      break;
    }

    case "safety": {
      const months = cushionMonths(s.structure);
      const owed = s.lent.outstandingPaise;
      const overdue = s.lent.people.filter((p) => p.overdue).length;
      if (owed > 0) figures.push(inr(owed));
      const cushion =
        months === null
          ? hi
            ? "अपने तय खर्च और अनुमान भरें ताकि इमरजेंसी कुशन दिखे"
            : "add your fixed costs and estimates to see your emergency cushion"
          : hi
            ? `आपके पास ${months} महीने का ज़रूरी खर्च अलग है (लक्ष्य ${CUSHION_MONTHS})${months >= CUSHION_MONTHS ? " — बढ़िया" : ""}`
            : `you have ${months} months of essentials set aside (aim for ${CUSHION_MONTHS})${months >= CUSHION_MONTHS ? " — good" : ""}`;
      const lentText =
        owed > 0
          ? hi
            ? `; ${inr(owed)} उधार पर है${overdue ? `, ${overdue} की तारीख निकल गई` : ""}`
            : `; ${inr(owed)} is lent out${overdue ? `, ${overdue} overdue` : ""}`
          : "";
      answer = hi
        ? `आपकी सुरक्षा जाँच: ${cushion}${lentText}; बैंक डेटा सिर्फ़ आपकी AA सहमति से आता है, जिसे आप कभी भी रोक सकते हैं। ज़रूरी नियम: UPI PIN या OTP कभी किसी को न बताएँ — पैसे लेने के लिए PIN नहीं लगता; उतना ही उधार दें जितना खो सकें; परिवार के लिए हेल्थ कवर ज़रूर रखें; और धोखाधड़ी हो तो तुरंत ${CYBER_HELPLINE} पर कॉल करें।`
        : `Your safety check: ${cushion}${lentText}; your bank data comes only through your AA consent, which you can pause any time. The basics: never share your UPI PIN or OTP — you never need a PIN to receive money; lend only what you could afford to lose; make sure your family has health cover; and if money is taken by fraud, call ${CYBER_HELPLINE} straight away.`;
      actionIds = ["emergency", "accounts"];
      break;
    }

    case "rewards": {
      const f = s.flow;
      const met = f.checks.filter((c) => c.met).map((c) => FLOW_NAMES[c.id][lang]);
      const todo = f.checks.filter((c) => !c.met).map((c) => FLOW_NAMES[c.id][lang]);
      let real = "";
      if (s.goal && !s.goal.onTrack && s.goal.projectedDateLabel) {
        figures.push(inr(s.goal.gapPaise));
        real = hi
          ? ` असली इनाम: ${inr(s.goal.gapPaise)} की कमी पूरी करने पर ${s.goal.name} ${s.goal.projectedDateLabel} की जगह ${s.goal.targetDateLabel} तक पूरा होगा।`
          : ` The real reward: closing your ${inr(s.goal.gapPaise)} gap gets ${s.goal.name} by ${s.goal.targetDateLabel} instead of ${s.goal.projectedDateLabel}.`;
      } else if (s.goal?.onTrack) {
        real = hi
          ? ` असली इनाम: ${s.goal.name} ${s.goal.targetDateLabel} तक पूरा होने की राह पर रहता है।`
          : ` The real reward: ${s.goal.name} stays on track for ${s.goal.targetDateLabel}.`;
      }
      const level = f.nextLevel
        ? hi
          ? ` आप ${f.level} लेवल पर हैं; ${f.monthsToNext} और परफ़ेक्ट महीने = ${f.nextLevel}।`
          : ` You're at ${f.level}; ${f.monthsToNext} more perfect ${f.monthsToNext === 1 ? "month" : "months"} in a row reaches ${f.nextLevel}.`
        : hi
          ? ` आप सबसे ऊँचे लेवल ${f.level} पर हैं।`
          : ` You're at the top level, ${f.level}.`;
      answer = hi
        ? `इस महीने 4 में से ${met.length} हो गए${met.length ? ` (${met.join(", ")})` : ""}${todo.length ? `; बाकी: ${todo.join(", ")}` : ""}। हर कदम के 25 फ़्लो पॉइंट, चारों से परफ़ेक्ट महीना।${level}${real} पॉइंट सिर्फ़ मज़े के लिए हैं, इनकी कोई पैसे की कीमत नहीं।`
        : `This month you've done ${met.length} of 4${met.length ? ` (${met.join(", ")})` : ""}${todo.length ? `; still to do: ${todo.join(", ")}` : ""}. Each is worth 25 flow points, and all four make a perfect month.${level}${real} Points are just for fun — they have no money value.`;
      actionIds = ["rewards"];
      break;
    }

    case "emergency": {
      const e = s.emergency;
      figures.push(inr(e.availablePaise));
      const steps: string[] = [];
      steps.push(
        hi
          ? `बिलों के बाद आपके पास ${inr(e.availablePaise)} हैं${e.monthsCovered !== null ? `, यानी लगभग ${e.monthsCovered} महीने का ज़रूरी खर्च` : ""}`
          : `you have ${inr(e.availablePaise)} free after bills${e.monthsCovered !== null ? `, about ${e.monthsCovered} months of essentials` : ""}`,
      );
      if (e.pauseGoalPaise > 0) {
        figures.push(inr(e.pauseGoalPaise));
        steps.push(hi ? `लक्ष्य की बचत रोकें: हर महीने ${inr(e.pauseGoalPaise)} बचेंगे` : `pause goal saving: frees ${inr(e.pauseGoalPaise)} a month`);
      }
      if (e.extrasPaise > 0) {
        figures.push(inr(e.extrasPaise));
        steps.push(hi ? `बाहर खाना, शॉपिंग जैसे खर्च रोकें: हर महीने ${inr(e.extrasPaise)} तक` : `stop extras like eating out and shopping: up to ${inr(e.extrasPaise)} a month`);
      }
      if (e.owedToYouPaise > 0) {
        figures.push(inr(e.owedToYouPaise));
        steps.push(hi ? `जिन पर पैसे बाकी हैं उनसे ${inr(e.owedToYouPaise)} वापस माँगें` : `call back the ${inr(e.owedToYouPaise)} people owe you`);
      }
      if (e.freeNowPaise > 0 && e.lockedPaise > 0) {
        figures.push(inr(e.freeNowPaise), inr(e.lockedPaise));
        steps.push(
          hi
            ? `ज़रूरत हो तो पहले आज निकल सकने वाले निवेश (${inr(e.freeNowPaise)}) इस्तेमाल करें, लॉक वाले (${inr(e.lockedPaise)}) बाद में — जल्दी निकालने पर जुर्माना लग सकता है`
            : `if you need more, use investments free today (${inr(e.freeNowPaise)}) before locked ones (${inr(e.lockedPaise)}), which can cost a penalty to break`,
        );
      } else if (e.freeNowPaise > 0) {
        figures.push(inr(e.freeNowPaise));
        steps.push(hi ? `ज़रूरत हो तो ${inr(e.freeNowPaise)} के निवेश आज निकाले जा सकते हैं` : `if you need more, ${inr(e.freeNowPaise)} of investments can come out today`);
      } else if (e.lockedPaise > 0) {
        figures.push(inr(e.lockedPaise));
        steps.push(
          hi
            ? `आपके ${inr(e.lockedPaise)} के निवेश अभी लॉक हैं — जल्दी तोड़ने पर जुर्माना लग सकता है, इसलिए इन्हें आख़िर में रखें`
            : `your ${inr(e.lockedPaise)} of investments is still locked — breaking it early can cost a penalty, so keep it for last`,
        );
      }
      const numbered = steps.map((t, n) => `${n + 1}) ${t}`).join(hi ? "। " : ". ");
      answer = hi
        ? `${e.mode ? "इमरजेंसी मोड चालू है। " : ""}घबराएँ नहीं — यह आपका प्लान है: ${numbered}। धोखाधड़ी हो तो ${CYBER_HELPLINE}, और मेडिकल या सुरक्षा की इमरजेंसी में 112 पर कॉल करें।`
        : `${e.mode ? "Emergency mode is on. " : ""}Take a breath — here's your plan: ${numbered}. For fraud call ${CYBER_HELPLINE}; for a medical or safety emergency call 112.`;
      actionIds = ["emergency"];
      if (e.owedToYouPaise > 0) actionIds.push("lent");
      break;
    }

    case "stress": {
      const capacity = s.capacityPaise;
      figures.push(inr(Math.abs(capacity)));
      let money: string;
      if (capacity <= 0) {
        money = hi
          ? `अभी आपके तय और आम खर्च आय से हर महीने लगभग ${inr(Math.abs(capacity))} ज़्यादा हैं — इसलिए यह भारी लगना स्वाभाविक है।`
          : `Right now your usual costs and spending come to about ${inr(Math.abs(capacity))} a month more than you earn, so it makes sense that it feels heavy.`;
      } else {
        let goalPart = "";
        if (s.goal && !s.goal.onTrack) {
          figures.push(inr(s.goal.gapPaise));
          goalPart = hi ? ` — ${s.goal.name} के लिए ${inr(s.goal.gapPaise)} कम` : `, which is ${inr(s.goal.gapPaise)} short of what ${s.goal.name} needs`;
        } else if (s.goal) {
          goalPart = hi ? `, और ${s.goal.name} सही रास्ते पर है` : `, and ${s.goal.name} is on track`;
        }
        money = hi
          ? `तय खर्च और आम खर्च के बाद हर महीने लगभग ${inr(capacity)} बचते हैं${goalPart}।`
          : `After your fixed costs and usual spending, about ${inr(capacity)} a month is left${goalPart}.`;
      }
      answer = hi
        ? `पैसों की चिंता बहुत आम है, और असली आँकड़े देखने से मदद मिलती है। ${money} इस हफ़्ते एक छोटा कदम इसे हल्का कर सकता है। अगर तनाव लंबे समय से नींद या मन पर असर कर रहा है, तो किसी भरोसेमंद व्यक्ति से बात करें या टेली-मानस को ${TELE_MANAS.short} पर कॉल करें (मुफ़्त, 24×7)।`
        : `Money worries are very common, and looking at the real numbers helps. ${money} One small step this week can make it feel lighter. If stress has been hurting your sleep or mood for a while, talk to someone you trust or call Tele-MANAS on ${TELE_MANAS.short} (free, 24×7).`;
      actionIds = ["emergency"];
      break;
    }

    case "fun_budget": {
      if (!s.fun) {
        answer = hi
          ? "Categories पेज पर Entertainment की सीमा तय करें, फिर मैं बता पाऊँगा कि हर महीने मज़े के लिए कितना बचा है।"
          : "Set a limit for Entertainment on the Categories page and I can tell you how much fun money is left each month.";
        break;
      }
      const f = s.fun;
      if (f.overPaise > 0) {
        figures.push(inr(f.budgetPaise), inr(f.spentPaise), inr(f.overPaise));
        answer = hi
          ? `इस महीने आपका मज़े का बजट ${inr(f.budgetPaise)} है; आप ${inr(f.spentPaise)} खर्च कर चुके हैं, जो ${inr(f.overPaise)} ज़्यादा है।`
          : `Your fun budget this month is ${inr(f.budgetPaise)}; you've used ${inr(f.spentPaise)}, which is ${inr(f.overPaise)} over.`;
      } else if (f.leftPaise === 0) {
        figures.push(inr(f.budgetPaise));
        answer = hi ? `इस महीने आपका मज़े का बजट ${inr(f.budgetPaise)} है, और यह पूरा खर्च हो चुका है।` : `Your fun budget this month is ${inr(f.budgetPaise)}, and it's all used.`;
      } else {
        figures.push(inr(f.budgetPaise), inr(f.spentPaise), inr(f.leftPaise));
        answer = hi
          ? `इस महीने आपका मज़े का बजट ${inr(f.budgetPaise)} है; आप ${inr(f.spentPaise)} खर्च कर चुके हैं, तो ${inr(f.leftPaise)} बचा है।`
          : `Your fun budget this month is ${inr(f.budgetPaise)}; you've used ${inr(f.spentPaise)}, so ${inr(f.leftPaise)} is left.`;
      }
      if (s.goal?.onTrack && s.goal.sparePaise > 0) {
        figures.push(inr(s.goal.sparePaise));
        answer += hi
          ? ` आपका लक्ष्य सही रास्ते पर है और हर महीने ${inr(s.goal.sparePaise)} अतिरिक्त है, तो एक तय ट्रीट ठीक है।`
          : ` Your goal is on track with ${inr(s.goal.sparePaise)} a month to spare, so a planned treat is fine.`;
      } else if (s.goal && !s.goal.onTrack) {
        figures.push(inr(s.goal.gapPaise));
        answer += hi
          ? ` आपका लक्ष्य हर महीने ${inr(s.goal.gapPaise)} पीछे है, इसलिए मज़ा इसी बजट में रखें।`
          : ` Your goal is ${inr(s.goal.gapPaise)} a month short, so keep fun within this.`;
      }
      break;
    }

    case "where_money":
      figures.push(inr(s.spendingPaise), ...top.map((c) => inr(c.paise)));
      answer = hi
        ? `${s.monthLabel} में आपका खर्च ${inr(s.spendingPaise)} रहा। सबसे ज़्यादा: ${topText || "अभी कोई खर्च नहीं"}।`
        : `In ${s.monthLabel} you spent ${inr(s.spendingPaise)}. The biggest categories: ${topText || "no spending yet"}.`;
      actionIds = ["insights"];
      break;
    case "how_much_save":
      figures.push(inr(s.capacityPaise));
      answer = hi
        ? `आपकी आय, तय खर्च और अनुमानित खर्च के हिसाब से आप हर महीने लगभग ${inr(s.capacityPaise)} बचा सकते हैं।`
        : `From your income, fixed costs and estimated spending, you can save about ${inr(s.capacityPaise)} a month.`;
      actionIds = ["goal"];
      break;
    case "reach_goal":
      actionIds = ["goal"];
      if (!s.goal) {
        answer = hi ? "अभी कोई लक्ष्य नहीं है। पहले एक लक्ष्य जोड़ें।" : "You have no goal yet. Add one first.";
        break;
      }
      figures.push(inr(s.goal.requiredPaise), inr(s.goal.contributionPaise));
      if (s.goal.onTrack) {
        answer = hi
          ? `हाँ। ${s.goal.name} के लिए हर महीने ${inr(s.goal.requiredPaise)} चाहिए और आप ${inr(s.goal.contributionPaise)} बचा सकते हैं, तो ${s.goal.targetDateLabel} तक पहुँचना संभव है।`
          : `Yes. ${s.goal.name} needs ${inr(s.goal.requiredPaise)} a month and you can put aside ${inr(s.goal.contributionPaise)}, so ${s.goal.targetDateLabel} is within reach.`;
      } else {
        figures.push(inr(s.goal.gapPaise));
        const when = s.goal.projectedDateLabel;
        answer = hi
          ? `अभी नहीं। ${s.goal.name} के लिए हर महीने ${inr(s.goal.requiredPaise)} चाहिए, आप ${inr(s.goal.contributionPaise)} बचा पा रहे हैं — ${inr(s.goal.gapPaise)} कम।${when ? ` इसी रफ़्तार से आप ${when} तक पहुँचेंगे।` : ""}`
          : `Not yet. ${s.goal.name} needs ${inr(s.goal.requiredPaise)} a month and you can put aside ${inr(s.goal.contributionPaise)}, which is ${inr(s.goal.gapPaise)} short.${when ? ` At this pace you get there by ${when}.` : ""}`;
      }
      break;
    case "what_cut": {
      actionIds = ["insights"];
      if (!s.cuts.length) {
        answer = hi ? "पिछले महीने कोई खर्च अनुमान से ज़्यादा नहीं गया।" : "Nothing ran over your estimates last month.";
        break;
      }
      const cutList = s.cuts.map((c) => `${c.name} ${inr(c.roomPaise)}`).join(", ");
      figures.push(inr(s.cutsTotalPaise), ...s.cuts.map((c) => inr(c.roomPaise)));
      answer = hi
        ? `सबसे ज़्यादा गुंजाइश यहाँ है: ${cutList} — कुल ${inr(s.cutsTotalPaise)} हर महीने।`
        : `The most room is in ${cutList} — ${inr(s.cutsTotalPaise)} a month in all.`;
      break;
    }
    default:
      answer = hi
        ? "मैं आपके पैसे के पूरे ढाँचे के हिसाब से बताता हूँ: अब क्या करें, वापस आए पैसे कहाँ लगाएँ, किस पर उधार बाकी है, सुरक्षा, इनाम और इमरजेंसी प्लान। नीचे से कोई सवाल चुनें।"
        : "I work from your whole money picture: what to do now, where money that comes back should go, who owes you, safety, rewards and an emergency plan. Pick a question below.";
  }
  return { intent, answer, figuresUsed: [...new Set(figures)], actionIds: actionIds.slice(0, 3), disclaimer };
}

/** Words that must never appear in a coach answer (no product names, no promised returns). */
const BLOCKED = [/guaranteed?\s+return/i, /assured\s+return/i, /\bbuy\s+(this|the)\s+(fund|stock|share)/i, /\b(nifty|sensex)\s*bees\b/i];

/** Post-check applied to every coach answer, AI or template. */
export function passesAdviceCheck(text: string): boolean {
  return !BLOCKED.some((re) => re.test(text));
}

/** Every rupee figure the snapshot holds, formatted the way answers write them. */
export function snapshotFigures(s: CoachSnapshot): Set<string> {
  const st = s.structure;
  const e = s.emergency;
  const paise = [
    s.incomePaise,
    s.spendingPaise,
    s.capacityPaise,
    s.cutsTotalPaise,
    ...s.topCategories.map((c) => c.paise),
    ...s.cuts.map((c) => c.roomPaise),
    ...(s.goal ? [s.goal.requiredPaise, s.goal.contributionPaise, s.goal.gapPaise, s.goal.sparePaise] : []),
    ...(s.fun ? [s.fun.budgetPaise, s.fun.spentPaise, s.fun.leftPaise, s.fun.overPaise] : []),
    st.balancePaise,
    st.essentialsPaise,
    st.extrasPaise,
    st.billsDuePaise,
    st.goalSavingPaise,
    st.goalGapPaise,
    st.owedToYouPaise,
    cushionTarget(st),
    freeBalance(st),
    s.lent.outstandingPaise,
    ...s.lent.people.map((p) => p.outstandingPaise),
    ...(s.lent.lastReturn ? [s.lent.lastReturn.amountPaise, ...s.lent.lastReturn.plan.map((a) => a.paise)] : []),
    e.availablePaise,
    e.essentialsPaise,
    e.pauseGoalPaise,
    e.extrasPaise,
    e.owedToYouPaise,
    e.freeNowPaise,
    e.lockedPaise,
  ];
  return new Set([...paise.flatMap((p) => [inr(p), inr(Math.abs(p))]), ...s.steps.flatMap((st) => st.figures)]);
}

/** Rupee figures in an answer that the snapshot does not contain — an AI answer with any is rejected. */
export function unknownFigures(text: string, allowed: Set<string>): string[] {
  return (text.match(/-?₹\s?\d+(?:,\d+)*(?:\.\d{1,2})?/g) ?? []).map((f) => f.replace(/\s/g, "")).filter((f) => !allowed.has(f));
}

/** Full check for an AI answer: no blocked wording, no invented figures, buttons only from COACH_ACTIONS. */
export function checkCoachAnswer(a: CoachAnswer, s: CoachSnapshot): boolean {
  return passesAdviceCheck(a.answer) && unknownFigures(a.answer, snapshotFigures(s)).length === 0 && a.actionIds.every((id) => id in COACH_ACTIONS);
}
