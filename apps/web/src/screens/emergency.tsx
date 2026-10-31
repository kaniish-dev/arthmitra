"use client";

import Link from "next/link";
import { CUSHION_MONTHS, CYBER_HELPLINE, TELE_MANAS, formatINR, todayIso } from "@arthmitra/engine";
import { setSettings } from "@/lib/actions";
import { emergencyFor, overview } from "@/lib/derive";
import { useAppData } from "@/lib/store";
import { Card, CardTitle, Disclaimer, Icon, PageHeader, Toggle, cx } from "@/components/ui";

const HELPLINES = [
  { number: "112", label: "Emergency", sub: "Police, fire and ambulance" },
  { number: CYBER_HELPLINE, label: "Cyber fraud", sub: "Money taken by fraud — call at once; also report at cybercrime.gov.in" },
  { number: TELE_MANAS.short, label: "Tele-MANAS", sub: "Free mental health support, 24×7" },
];

/** What to do when money gets tight suddenly: how long savings last, what to pause, what to call back. */
export function EmergencyScreen() {
  const data = useAppData()!;
  const o = overview(data, todayIso());
  const e = emergencyFor(data, o);
  const on = data.settings.emergencyMode;

  const steps: Array<{ title: string; text: string; href?: string; link?: string }> = [
    {
      title: "Pay essentials first",
      text: `Rent, bills, groceries, health and EMIs come to about ${formatINR(e.essentialsPaise)} a month.`,
      href: "/bills",
      link: "Bills",
    },
  ];
  if (e.pauseGoalPaise > 0) steps.push({ title: "Pause goal saving", text: `Frees ${formatINR(e.pauseGoalPaise)} a month until things settle.`, href: "/plan", link: "My plans" });
  if (e.extrasPaise > 0) steps.push({ title: "Stop the extras", text: `Eating out, travel, shopping and fun: up to ${formatINR(e.extrasPaise)} a month.`, href: "/insights", link: "Budgets" });
  if (e.owedToYouPaise > 0) steps.push({ title: "Call back money owed to you", text: `${formatINR(e.owedToYouPaise)} is lent out or owed from split bills.`, href: "/lent", link: "Lent and split" });
  if (e.freeNowPaise > 0 || e.lockedPaise > 0) {
    const free = e.freeNowPaise > 0 ? `${formatINR(e.freeNowPaise)} can come out today.` : "";
    const locked = e.lockedPaise > 0 ? `${formatINR(e.lockedPaise)} is still locked — breaking it early can cost a penalty, so keep it for last.` : "";
    steps.push({
      title: e.freeNowPaise > 0 ? "Use free investments before locked ones" : "Keep locked investments for last",
      text: [free, locked].filter(Boolean).join(" "),
      href: "/portfolio",
      link: "Portfolio",
    });
  }
  steps.push({ title: "Talk to lenders early", text: "If an EMI or rent is due, speak to the lender or landlord before a payment is missed." });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Emergency plan" subtitle="If money gets tight suddenly — a job loss, an illness, a family need." />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="flex flex-col gap-6">
          <section className={cx("rounded-3xl p-5 sm:p-6", on ? "bg-error-container text-on-error-container" : "bg-surface-container-lowest ring-1 ring-outline-variant/40")}>
            <p className="text-sm opacity-80">Your money lasts about</p>
            <p className="text-4xl font-semibold tabular-nums">{e.monthsCovered === null ? "—" : `${e.monthsCovered} months`}</p>
            <p className="mt-1 text-sm opacity-80">
              {formatINR(e.availablePaise)} free after bills ÷ {formatINR(e.essentialsPaise)} of essentials a month
            </p>
            {e.monthsWithEverything !== null && e.monthsCovered !== null && e.monthsWithEverything > e.monthsCovered && (
              <p className="mt-2 text-sm">Up to {e.monthsWithEverything} months with money owed to you and investments free today.</p>
            )}
            <p className="mt-3 text-xs opacity-80">Aim to keep {CUSHION_MONTHS} months of essentials aside for emergencies.</p>
          </section>
          <Card>
            <Toggle
              label="Emergency mode"
              description="Puts this plan first on Home and pauses goal nudges. Turn it off when things settle."
              checked={on}
              onChange={(v) => setSettings({ emergencyMode: v })}
            />
          </Card>
          <Card>
            <CardTitle icon="call">Helplines</CardTitle>
            <ul className="flex flex-col gap-2">
              {HELPLINES.map((h) => (
                <li key={h.number}>
                  <a href={`tel:${h.number}`} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-on-surface/5">
                    <span className="flex h-11 w-14 shrink-0 items-center justify-center rounded-xl bg-error-container font-semibold text-on-error-container tabular-nums">
                      {h.number}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{h.label}</span>
                      <span className="block text-xs text-on-surface-variant">{h.sub}</span>
                    </span>
                    <Icon name="call" className="text-primary" />
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardTitle icon="checklist">What to do, in order</CardTitle>
            <ol className="flex flex-col gap-4">
              {steps.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{s.title}</p>
                    <p className="text-sm text-on-surface-variant">{s.text}</p>
                    {s.href && (
                      <Link href={s.href} className="text-sm font-semibold text-primary hover:underline">
                        {s.link}
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
          <Card>
            <CardTitle icon="shield">Stay safe while it&apos;s hard</CardTitle>
            <ul className="flex flex-col gap-2 text-sm">
              <li>Never share your UPI PIN or OTP. You never need a PIN to receive money.</li>
              <li>&quot;Instant loan&quot; offers on calls and messages are a common trap — borrow only from a bank or a lender registered with RBI.</li>
              <li>Lost your phone? Block UPI and cards from your bank straight away.</li>
            </ul>
          </Card>
          <Disclaimer />
        </div>
      </div>
    </div>
  );
}
