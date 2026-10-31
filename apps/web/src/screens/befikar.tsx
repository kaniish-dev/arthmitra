"use client";

import { useState } from "react";
import { formatDate, formatINR } from "@arthmitra/engine";
import { BEFIKAR_SAMPLE } from "@/config/befikar";
import { FEATURES } from "@/lib/constants";
import { Badge, Card, Disclaimer, Icon, LinkButton, PageHeader, cx } from "@/components/ui";

const R = (rupees: number) => rupees * 100;

/**
 * Befikar Mode — the Freedom Date: the day passive income from the portfolio covers all monthly
 * expenses. A vision feature: this screen sells it with one clearly labelled sample from config;
 * nothing here is calculated live.
 */
export function BefikarScreen() {
  const s = BEFIKAR_SAMPLE;
  const [pick, setPick] = useState(1);
  const scenario = s.scenarios[pick]!;
  const coverage = s.passiveIncomeTodayRupees / s.monthlyExpensesRupees;
  const deg = Math.round(coverage * 360);

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <PageHeader title={FEATURES.befikarMode.name} subtitle="Coming soon · the vision for ArthMitra" back="/dashboard" />
      <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-[#00513a] to-[#146c2e] p-6 text-white sm:p-8">
        <div aria-hidden className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/10" />
        <Badge tone="warn" icon="schedule">
          Coming soon
        </Badge>
        <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">Your Freedom Date</h2>
        <p className="mt-2 max-w-lg text-white/90">
          The day the passive income from your portfolio pays every bill — rent, food, Netflix, all of it. Work becomes a choice, not a need. That&apos;s befikar.
        </p>
        <p className="mt-4 text-lg font-semibold">Start early, save early.</p>
      </section>

      <Card className="mt-5">
        <p className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <span className="rounded-full bg-warning-container px-2 py-0.5 text-xs text-on-warning-container">Sample</span>
          {s.persona}
        </p>
        <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-[auto_1fr]">
          <div
            role="img"
            aria-label={`Sample progress: passive income covers ${Math.round(coverage * 100)}% of expenses`}
            className="relative mx-auto h-40 w-40 rounded-full"
            style={{ background: `conic-gradient(#146c2e ${deg}deg, #dfe4dc ${deg}deg)` }}
          >
            <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-surface-container-lowest text-center">
              <span className="text-3xl font-semibold tabular-nums">{Math.round(coverage * 100)}%</span>
              <span className="px-2 text-[11px] text-on-surface-variant">of expenses covered</span>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs text-on-surface-variant">Freedom Date</dt>
              <dd className="text-xl font-semibold">{formatDate(scenario.freedomDate)}</dd>
            </div>
            <div>
              <dt className="text-xs text-on-surface-variant">Age then</dt>
              <dd className="text-xl font-semibold">{scenario.age}</dd>
            </div>
            <div>
              <dt className="text-xs text-on-surface-variant">Monthly expenses</dt>
              <dd className="font-semibold tabular-nums">{formatINR(R(s.monthlyExpensesRupees))}</dd>
            </div>
            <div>
              <dt className="text-xs text-on-surface-variant">Passive income today</dt>
              <dd className="font-semibold tabular-nums">{formatINR(R(s.passiveIncomeTodayRupees))}/mo</dd>
            </div>
          </dl>
        </div>

        <h3 className="mt-6 mb-2 font-semibold">Save more each month → the date comes closer</h3>
        <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-3">
          {s.scenarios.map((sc, i) => (
            <button
              key={sc.monthlyRupees}
              type="button"
              aria-pressed={pick === i}
              onClick={() => setPick(i)}
              className={cx("rounded-2xl border p-3 text-left", pick === i ? "border-primary bg-primary-container/60" : "border-outline-variant hover:bg-on-surface/4")}
            >
              <span className="block text-sm font-semibold tabular-nums">{formatINR(R(sc.monthlyRupees))}/mo</span>
              <span className="block text-xs text-on-surface-variant">Free by {formatDate(sc.freedomDate).slice(-8)}</span>
            </button>
          ))}
        </div>

        <h3 className="mt-6 mb-2 font-semibold">Start early, save early</h3>
        <ul className="flex flex-col gap-2 text-sm">
          {s.startEarly.map((x) => (
            <li key={x.startAge} className="flex items-center justify-between rounded-2xl bg-surface-container px-4 py-3">
              <span>
                <Icon name="person" className="mr-1 align-[-5px] text-[20px]" /> ₹10,000/month from age {x.startAge}
              </span>
              <strong className="tabular-nums">{formatINR(R(x.corpusAt50Rupees))} by 50</strong>
            </li>
          ))}
        </ul>
        <Disclaimer className="mt-4" text="Illustrative sample values, not a calculation for you. Educational guidance, not investment advice. Returns are not guaranteed." />
      </Card>

      <div className="mt-5 flex flex-wrap gap-2">
        <LinkButton href="/explore?path=wealth" icon={FEATURES.wealth.icon}>
          Start the {FEATURES.wealth.name}
        </LinkButton>
        <LinkButton href="/learn/read?id=retired-at-29" variant="outlined" icon="auto_stories">
          Read: retired at 29
        </LinkButton>
      </div>
    </div>
  );
}
