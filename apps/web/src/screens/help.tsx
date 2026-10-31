"use client";

import { useAppData } from "@/lib/store";
import { Card, CardTitle, Icon, PageHeader } from "@/components/ui";

const STEPS = [
  { icon: "account_balance", text: "Link your bank through an Account Aggregator with consent, upload a CSV if your bank isn't on the network yet, or add cash spends yourself." },
  { icon: "auto_awesome", text: "Each payment is sorted into a category. Unclear ones wait in your inbox with three suggestions." },
  { icon: "flag", text: "Your income, fixed costs and spending become one number: what you can save each month for your goal." },
  { icon: "savings", text: "You invest in your own bank or app. When the debit arrives, ArthMitra confirms it and moves your goal forward." },
  { icon: "handshake", text: "Lent money to someone? Record it. When it comes back, ArthMitra spots it and the coach shows where it should go: bills, your emergency cushion, your goal, then you." },
  { icon: "emergency_home", text: "If money gets tight suddenly, the emergency plan shows how long your money lasts, what to pause and what to call back." },
];

const SAFETY = [
  "Never share your UPI PIN or OTP with anyone, even someone who says they are from ArthMitra or your bank.",
  "You never need a PIN to receive money. A request that asks for one is a scam.",
  "ArthMitra never calls you to ask for details, and never sends payment requests.",
];

/** Static help: how it works, staying safe, and common questions. */
export function HelpScreen() {
  const data = useAppData()!;
  const threshold = Math.round(data.settings.confidenceThreshold * 100);
  const faq = [
    {
      q: "Is ArthMitra a payment app?",
      a: "No. It looks like one so it feels familiar, but it never sends, receives or holds money. Payments happen in your bank or UPI app; ArthMitra only reads and sorts them.",
    },
    {
      q: "Why did a payment land in my inbox?",
      a: `ArthMitra files a payment by itself only when it is at least ${threshold}% sure of the category. Anything less waits for you with three suggestions. Pick one and choose "Always use" so it never asks about that shop again.`,
    },
    {
      q: "How is “you can save” worked out?",
      a: "Your monthly income, minus fixed costs like rent and EMIs, minus your own estimates for everyday spending. The goal plan compares it with what the goal needs each month.",
    },
    {
      q: "What is an Account Aggregator?",
      a: "An RBI-licensed go-between that moves your bank statement to an app only after you approve a consent on the AA's own page. ArthMitra asks for balance and transactions only, never your name, PAN or address, and you can pause or revoke the consent any time.",
    },
    {
      q: "What does the coach tell me?",
      a: "What to do next, where money that comes back should go, who still owes you, how safe you are if something goes wrong, what a perfect month earns, and an emergency plan — all from your own figures. It never names a fund or stock, and never moves money.",
    },
    {
      q: "Does ArthMitra ask people to pay me back?",
      a: "No. It only keeps the record and spots the payback when it arrives in your bank. If you want to remind someone, it prepares a polite message you send yourself.",
    },
    {
      q: "Does ArthMitra recommend funds or stocks?",
      a: "No. It shows types of instruments that suit how far away your goal is, the same list for everyone. It never names a fund, stock or insurance product, and never promises a return.",
    },
    {
      q: "What does ArthMitra know about me?",
      a: "Only what you enter and the payments you choose to share. It keeps the last 4 digits of an account number. AI sees shop names, amounts and totals, never your name or account numbers.",
    },
    {
      q: "How do I take my data out or delete it?",
      a: "Settings → Your data. Export everything as a file, withdraw consent for bank data or AI, or delete everything.",
    },
    {
      q: "Do points and badges have money value?",
      a: "No. They are just for fun and can't be exchanged for anything.",
    },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Help and safety" back="/profile" />
      <div className="flex flex-col gap-6">
        <Card>
          <CardTitle icon="lightbulb">How ArthMitra works</CardTitle>
          <ol className="flex flex-col gap-4">
            {STEPS.map((s, i) => (
              <li key={s.icon} className="flex items-start gap-3 text-sm">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary">{i + 1}</span>
                <span className="pt-1">{s.text}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="bg-error-container/40">
          <CardTitle icon="shield">Stay safe</CardTitle>
          <ul className="flex flex-col gap-3 text-sm">
            {SAFETY.map((s) => (
              <li key={s} className="flex items-start gap-3">
                <Icon name="block" className="text-error" />
                {s}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-3 sm:p-4">
          <h2 className="px-2 pt-1 pb-2 text-base font-semibold">Common questions</h2>
          <div className="divide-y divide-outline-variant/50">
            {faq.map((f) => (
              <details key={f.q} className="group px-2">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3.5 text-sm font-medium">
                  {f.q}
                  <Icon name="expand_more" className="text-on-surface-variant transition-transform group-open:rotate-180" />
                </summary>
                <p className="pb-4 text-sm text-on-surface-variant">{f.a}</p>
              </details>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle icon="support_agent">Questions or complaints</CardTitle>
          <p className="text-sm text-on-surface-variant">
            This is a hackathon prototype. Before launch, a grievance officer&apos;s name and contact details go here, as the Digital Personal Data
            Protection Act requires.
          </p>
        </Card>

        <p className="pb-2 text-center text-xs text-on-surface-variant">Educational guidance, not financial advice.</p>
      </div>
    </div>
  );
}
