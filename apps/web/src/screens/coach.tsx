"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  COACH_ACTIONS,
  CYBER_HELPLINE,
  DISCLAIMER_HI,
  SUGGESTED_QUESTIONS,
  TELE_MANAS,
  detectIntent,
  formatDate,
  formatINR,
  goalAsk,
  passesAdviceCheck,
  templateAnswer,
  todayIso,
  usesModel,
  type CoachActionId,
  type CoachIntent,
  type CoachLang,
  type GoalAsk,
} from "@arthmitra/engine";
import { addCoachGoal } from "@/lib/actions";
import { FEATURES } from "@/lib/constants";
import { useToast } from "@/components/providers";
import { DISCLAIMER } from "@arthmitra/schema";
import { coachSnapshot, overview, stepsFor } from "@/lib/derive";
import { useAppData } from "@/lib/store";
import { Button, Card, Chip, Icon, PageHeader, cx } from "@/components/ui";

interface Message {
  id: number;
  role: "user" | "coach";
  /** Language the message was written in; buttons inside it stay in that language. */
  lang: CoachLang;
  text: string;
  intent?: CoachIntent;
  actionIds?: string[];
  disclaimer?: string;
  /** Who wrote the answer: Gemini, or the engine's templates. */
  source?: "gemini" | "template";
  /** A goal read from the question, offered as "Make it a savings goal". */
  ask?: GoalAsk | null;
}

/** Asks the Gemini route; null means use the template answer (AI off, no key, rate limit, failed check). */
async function askGemini(question: string, lang: CoachLang, snapshot: unknown): Promise<{ answer: string; actionIds: string[] } | null> {
  try {
    const res = await fetch("/api/coach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question, lang, snapshot }) });
    return res.ok ? ((await res.json()) as { answer: string; actionIds: string[] }) : null;
  } catch {
    return null;
  }
}

/**
 * Money coach (F19). Works from the whole structure — balance, bills, cushion, money lent, goal,
 * monthly flow and the emergency plan. With AI on, the snapshot and the instruction in
 * coach-prompt.ts go to Gemini (free API tier, via /api/coach); templates answer safety
 * questions and stand in whenever Gemini is unavailable.
 */
export function CoachScreen() {
  const data = useAppData()!;
  const [lang, setLang] = useState<CoachLang>("en");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const nextId = useRef(0);
  const end = useRef<HTMLDivElement>(null);
  const hi = lang === "hi";
  const steps = stepsFor(data, overview(data, todayIso()));

  // Braces matter: scrollIntoView can return a Promise in newer browsers, and an effect must not return one.
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const ask = async (question: string) => {
    if (!question.trim() || thinking) return;
    const askedIn = lang;
    const intent = detectIntent(question);
    // "A 40k trip in March", "a fridge worth 30k in 3 months": sized here, so every figure is the app's.
    const ask = intent === "afford" || intent === "new_goal" ? goalAsk(question, todayIso()) : null;
    const snapshot = {
      ...coachSnapshot(data, overview(data, todayIso())),
      ask: ask ? { name: ask.name, amountPaise: ask.amountPaise, months: ask.months, monthlyPaise: ask.monthlyPaise, targetDateLabel: formatDate(ask.targetDate) } : null,
    };
    const answer = templateAnswer(intent, snapshot, askedIn, question);
    const safe = passesAdviceCheck(answer.answer) ? answer : templateAnswer("unknown", snapshot, askedIn);
    setMessages((m) => [...m, { id: nextId.current++, role: "user", lang: askedIn, text: question.trim() }]);
    setInput("");

    let reply: Message = { id: nextId.current++, role: "coach", lang: askedIn, text: safe.answer, intent: safe.intent, actionIds: safe.actionIds, disclaimer: safe.disclaimer, source: "template", ask };
    if (data.settings.aiEnabled && usesModel(intent)) {
      setThinking(true);
      const ai = await askGemini(question, askedIn, snapshot);
      setThinking(false);
      if (ai) reply = { ...reply, text: ai.answer, actionIds: ai.actionIds, disclaimer: askedIn === "hi" ? DISCLAIMER_HI : DISCLAIMER, source: "gemini" };
    }
    setMessages((m) => [...m, reply]);
  };

  const groups = [
    { key: "plan", label: hi ? "योजना और सुरक्षा" : "Plan and safety" },
    { key: "money", label: hi ? "पैसा" : "Money" },
  ] as const;

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <PageHeader
        title={FEATURES.coach.name}
        subtitle={hi ? "आपका AI पैसे वाला दोस्त — खर्च, योजनाएँ और पोर्टफोलियो जानता है।" : "Your AI money buddy — knows your spending, plans and portfolio. Ask anything."}
        action={
          <div className="flex gap-2" role="group" aria-label="Language">
            <Chip selected={lang === "en"} onClick={() => setLang("en")}>
              English
            </Chip>
            <Chip selected={lang === "hi"} onClick={() => setLang("hi")} lang="hi">
              हिंदी
            </Chip>
          </div>
        }
      />

      <Card className="mb-4 flex min-h-[50vh] flex-col">
        <div className="flex flex-1 flex-col gap-3" aria-live="polite">
          {messages.length === 0 && (
            <div className="m-auto flex w-full max-w-xl flex-col gap-5 py-2" lang={lang}>
              {steps.length > 0 && (
                <section aria-label={hi ? "अभी के कदम" : "Next steps"}>
                  <p className="mb-2 flex items-center gap-2 font-semibold">
                    <Icon name="forum" className="text-primary" />
                    {hi ? "अभी मैं यह सुझाऊँगा" : "Right now I'd suggest"}
                  </p>
                  <ol className="flex flex-col gap-2">
                    {steps.map((s, i) => (
                      <li key={s.kind}>
                        <Link href={COACH_ACTIONS[s.action].href} className="flex items-center gap-3 rounded-2xl bg-surface-container px-3 py-2.5 hover:bg-surface-container-high">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary">{i + 1}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">{s.title[lang]}</span>
                            <span className="block text-xs text-on-surface-variant">{s.detail[lang]}</span>
                          </span>
                          <Icon name="chevron_right" className="text-on-surface-variant" />
                        </Link>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
              {groups.map((g) => (
                <div key={g.key} className="flex w-full flex-col items-center gap-2 text-center">
                  <p className="text-xs font-semibold tracking-wide text-on-surface-variant uppercase">{g.label}</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {SUGGESTED_QUESTIONS[lang]
                      .filter((q) => q.group === g.key)
                      .map((q) => (
                        <Chip key={q.intent} onClick={() => ask(q.text)}>
                          {q.text}
                        </Chip>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="max-w-[85%] self-end rounded-3xl bg-primary px-4 py-3 text-sm text-on-primary" lang={m.lang}>
                <p>{m.text}</p>
              </div>
            ) : (
              <CoachBubble key={m.id} message={m} />
            ),
          )}
          {thinking && (
            <p className="self-start rounded-3xl bg-surface-container px-4 py-3 text-sm text-on-surface-variant" role="status">
              {hi ? "सोच रहा हूँ…" : "Thinking…"}
            </p>
          )}
          <div ref={end} />
        </div>
      </Card>

      {/* Once the chat has started, the questions shrink to one scrolling row. */}
      {messages.length > 0 && (
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0" lang={lang}>
          {SUGGESTED_QUESTIONS[lang].map((q) => (
            <Chip key={q.intent} className="shrink-0 whitespace-nowrap" onClick={() => ask(q.text)}>
              {q.text}
            </Chip>
          ))}
        </div>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <label htmlFor="coach-input" className="sr-only">
          Your question
        </label>
        <input
          id="coach-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          lang={lang}
          placeholder={hi ? "अपना सवाल लिखें, जैसे “₹5,000 वापस आए”" : "Ask anything, like “I got ₹5,000 back”"}
          className="min-w-0 flex-1 rounded-full border border-outline bg-surface-container-lowest px-5 py-3 text-base focus:border-primary focus:outline-none"
          maxLength={300}
        />
        <Button type="submit" icon="send" disabled={!input.trim() || thinking} aria-label="Send" className="shrink-0 px-4 sm:px-5">
          <span className="hidden sm:inline">{hi ? "भेजें" : "Send"}</span>
        </Button>
      </form>
      <p className="mt-3 text-center text-xs text-on-surface-variant">
        {data.settings.aiEnabled ? (hi ? "Gemini जवाब · न मिलें तो तय जवाब" : "Gemini answers · set answers as backup") : hi ? "AI बंद · तय जवाब" : "AI off · set answers"} ·{" "}
        {hi ? DISCLAIMER_HI : DISCLAIMER}
      </p>
    </div>
  );
}

const CALL = "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors";

function CoachBubble({ message: m }: { message: Message }) {
  const lang = m.lang;
  const hi = lang === "hi";
  const urgent = m.intent === "crisis" || m.intent === "emergency";
  const actions = (m.actionIds ?? []).filter((id): id is CoachActionId => id in COACH_ACTIONS);
  return (
    <div className={cx("max-w-[92%] self-start rounded-3xl px-4 py-3 text-sm sm:max-w-[85%]", m.intent === "crisis" ? "bg-error-container text-on-error-container" : "bg-surface-container")} lang={lang}>
      <p>{m.text}</p>
      {urgent && (
        <div className="mt-3 flex flex-wrap gap-2">
          {/* Plain links: tel: is not a page to route or prefetch. */}
          {m.intent === "crisis" ? (
            <a href={`tel:${TELE_MANAS.short}`} className={cx(CALL, "bg-primary text-on-primary hover:bg-primary/90")}>
              <Icon name="call" className="text-[20px]" />
              {hi ? "टेली-मानस" : "Call Tele-MANAS"} {TELE_MANAS.short}
            </a>
          ) : (
            <a href={`tel:${CYBER_HELPLINE}`} className={cx(CALL, "border border-outline hover:bg-on-surface/8")}>
              <Icon name="call" className="text-[20px]" />
              {hi ? "फ्रॉड" : "Fraud"} {CYBER_HELPLINE}
            </a>
          )}
          <a href="tel:112" className={cx(CALL, "border border-outline hover:bg-on-surface/8")}>
            <Icon name="emergency" className="text-[20px]" />
            112
          </a>
        </div>
      )}
      {actions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map((id) => (
            <Link
              key={id}
              href={COACH_ACTIONS[id].href}
              className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-lowest px-3 py-1.5 text-sm font-semibold text-primary ring-1 ring-outline-variant/60 hover:bg-primary/8"
            >
              <Icon name={COACH_ACTIONS[id].icon} className="text-[18px]" />
              {COACH_ACTIONS[id][lang]}
            </Link>
          ))}
        </div>
      )}
      {m.ask && <MakeGoal ask={m.ask} hi={hi} />}
      {m.disclaimer && (
        <p className={cx("mt-2 flex items-center gap-1 text-xs", m.intent === "crisis" ? "text-on-error-container/80" : "text-on-surface-variant")}>
          <Icon name="info" className="text-[14px]" />
          {m.disclaimer}
          {m.source === "gemini" && " · Gemini"}
        </p>
      )}
    </div>
  );
}

/** Turns a goal from the chat into a small savings goal (no investment plan yet). */
function MakeGoal({ ask, hi }: { ask: GoalAsk; hi: boolean }) {
  const toast = useToast();
  const [id, setId] = useState<string | null>(null);
  if (id)
    return (
      <Link href={`/plan/view?id=${id}`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-success">
        <Icon name="check_circle" className="text-[18px]" />
        {hi ? "लक्ष्य बन गया — योजना देखें" : "Goal added — open it to pick a plan"}
      </Link>
    );
  return (
    <button
      type="button"
      onClick={() => {
        setId(addCoachGoal(ask.name, ask.amountPaise, ask.targetDate));
        toast({ message: `${ask.name}: ${formatINR(ask.amountPaise)} by ${formatDate(ask.targetDate)} added to your plans.` });
      }}
      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary/90"
    >
      <Icon name="add_task" className="text-[18px]" />
      {hi ? `${ask.name} को बचत लक्ष्य बनाएँ (${formatINR(ask.monthlyPaise)}/महीना)` : `Make "${ask.name}" a savings goal · ${formatINR(ask.monthlyPaise)}/mo`}
    </button>
  );
}
