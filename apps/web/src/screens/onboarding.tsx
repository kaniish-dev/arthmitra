"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  addMonths,
  capacityFromProfile,
  formatDate,
  formatINR,
  isValidIso,
  spendCategories,
  todayIso,
} from "@arthmitra/engine";
import type { FixedExpense, Goal, RiskComfort } from "@arthmitra/schema";
import { completeOnboarding, newId } from "@/lib/actions";
import { useAppData } from "@/lib/store";
import { DemoBanner } from "@/components/app-shell";
import { AmountInput, Button, Card, Chip, Icon, Loading, TextInput, Toggle, cx } from "@/components/ui";

const R = (rupees: number) => rupees * 100;

/** Generic starting estimates the user edits (PRD: pre-filled, editable). */
const GENERIC_ESTIMATES: Record<string, number> = {
  food: R(6_000),
  groceries: R(4_000),
  travel: R(2_500),
  shopping: R(2_500),
  entertainment: R(1_500),
  health: R(1_000),
  others: R(1_500),
};

const GOAL_KINDS: Array<{ kind: Goal["kind"]; label: string; icon: string }> = [
  { kind: "car", label: "Car", icon: "directions_car" },
  { kind: "wedding", label: "Wedding", icon: "favorite" },
  { kind: "trip", label: "Trip", icon: "flight" },
  { kind: "emergency", label: "Emergency fund", icon: "health_and_safety" },
  { kind: "home", label: "Home", icon: "home" },
  { kind: "education", label: "Education", icon: "school" },
  { kind: "custom", label: "Something else", icon: "star" },
];

const RISK: Array<{ value: RiskComfort; label: string; text: string }> = [
  { value: "low", label: "Low", text: "I can't see the amount go down" },
  { value: "medium", label: "Medium", text: "Small dips are fine" },
  { value: "high", label: "High", text: "I can wait out big swings" },
];

const STEPS = ["About you", "Income", "Fixed costs", "Monthly spend", "Your goal", "Your plan"];

export function OnboardingScreen() {
  const data = useAppData();
  if (data === null) return <Loading />;
  return <OnboardingForm key={data.profile?.createdAt ?? "new"} />;
}

function OnboardingForm() {
  const router = useRouter();
  const data = useAppData()!;
  const existing = data.profile;
  const existingGoal = data.goals[0];
  const today = todayIso();

  const [step, setStep] = useState(0);
  const [name, setName] = useState(existing?.name ?? "");
  const [adult, setAdult] = useState(Boolean(existing));
  const [income, setIncome] = useState<number | null>(existing?.monthlyIncomePaise ?? null);
  const [otherIncome, setOtherIncome] = useState<number | null>(existing?.otherIncomePaise || null);
  const [fixed, setFixed] = useState<FixedExpense[]>(
    existing?.fixedExpenses.length
      ? existing.fixedExpenses
      : [
          { id: "fx-rent", name: "Rent", amountPaise: 0, category: "rent" },
          { id: "fx-emi", name: "EMI", amountPaise: 0, category: "emi" },
          { id: "fx-fees", name: "Children's fees", amountPaise: 0, category: "education" },
        ],
  );
  const [estimates, setEstimates] = useState<Record<string, number>>(existing?.estimatedSpend ?? GENERIC_ESTIMATES);
  const [kind, setKind] = useState<Goal["kind"]>(existingGoal?.kind ?? "car");
  const [goalName, setGoalName] = useState(existingGoal?.name ?? "Car down payment");
  const [target, setTarget] = useState<number | null>(existingGoal?.targetPaise ?? null);
  const [targetDate, setTargetDate] = useState(existingGoal?.targetDate ?? addMonths(today, 12));
  const [risk, setRisk] = useState<RiskComfort>(existing?.riskComfort ?? "medium");
  const [aiConsent, setAiConsent] = useState(data.settings.aiEnabled);

  const variableCats = spendCategories(data.categories).filter((c) => !["rent", "emi", "bills", "education"].includes(c.id));
  const capacity = capacityFromProfile({
    name: name || "You",
    is18Plus: true,
    monthlyIncomePaise: income ?? 0,
    otherIncomePaise: otherIncome ?? 0,
    fixedExpenses: fixed,
    estimatedSpend: estimates,
    riskComfort: risk,
    points: 0,
    streak: 0,
    lastSortDate: null,
    badges: [],
    createdAt: today,
  });

  const canContinue = [
    name.trim().length > 0 && adult,
    (income ?? 0) > 0,
    true,
    true,
    (target ?? 0) > 0 && goalName.trim().length > 0 && isValidIso(targetDate) && targetDate > today,
    true,
  ][step];

  const finish = () => {
    completeOnboarding({
      name: name.trim(),
      monthlyIncomePaise: income ?? 0,
      otherIncomePaise: otherIncome ?? 0,
      fixedExpenses: fixed,
      estimatedSpend: estimates,
      riskComfort: risk,
      goal: { name: goalName.trim(), kind, targetPaise: target!, targetDate },
      aiConsent,
    });
    router.push(data.accounts.length ? "/dashboard" : "/link-bank");
  };

  return (
    <div className="min-h-screen">
      <DemoBanner />
      <main className="mx-auto max-w-xl px-4 py-8">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-on-primary">
            <Icon name="currency_rupee" />
          </span>
          <span className="text-lg font-bold">ArthMitra</span>
        </div>
        <ol aria-label="Progress" className="mb-6 flex gap-1.5">
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1" aria-current={i === step ? "step" : undefined}>
              <span className={cx("block h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-surface-container-highest")} />
              <span className="sr-only">{s}</span>
            </li>
          ))}
        </ol>
        <p className="text-sm font-medium text-primary">
          Step {step + 1} of {STEPS.length}
        </p>
        <h1 className="mb-6 text-2xl font-semibold">{STEPS[step]}</h1>

        <Card>
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!canContinue) return;
              if (step < STEPS.length - 1) setStep(step + 1);
              else finish();
            }}
          >
            {step === 0 && (
              <>
                <TextInput label="What should we call you?" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={60} />
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" className="mt-0.5 h-5 w-5 accent-primary" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
                  <span>I am 18 or older. ArthMitra is for adults only.</span>
                </label>
              </>
            )}

            {step === 1 && (
              <>
                <AmountInput label="Monthly salary (in hand)" valuePaise={income} onChange={setIncome} autoFocus hint="Required. Amounts accept Indian grouping, e.g. 1,23,456." />
                <AmountInput label="Other monthly income (optional)" valuePaise={otherIncome} onChange={setOtherIncome} hint="Rent received, freelance, interest." />
              </>
            )}

            {step === 2 && (
              <>
                <p className="text-sm text-on-surface-variant">Costs that are the same every month. Leave a row at 0 if it doesn&apos;t apply.</p>
                {fixed.map((f, i) => (
                  <div key={f.id} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                    <TextInput
                      label="Name"
                      value={f.name}
                      onChange={(e) => setFixed(fixed.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    />
                    <AmountInput
                      label="Per month"
                      valuePaise={f.amountPaise || null}
                      onChange={(p) => setFixed(fixed.map((x, j) => (j === i ? { ...x, amountPaise: p ?? 0 } : x)))}
                    />
                    <button
                      type="button"
                      aria-label={`Remove ${f.name}`}
                      onClick={() => setFixed(fixed.filter((_, j) => j !== i))}
                      className="mb-1 rounded-full p-2 text-on-surface-variant hover:bg-on-surface/8"
                    >
                      <Icon name="delete" />
                    </button>
                  </div>
                ))}
                <Button
                  variant="text"
                  icon="add"
                  className="self-start"
                  onClick={() => setFixed([...fixed, { id: newId("fx"), name: "Bills", amountPaise: 0, category: "bills" }])}
                >
                  Add a fixed cost
                </Button>
              </>
            )}

            {step === 3 && (
              <>
                <p className="text-sm text-on-surface-variant">Rough guesses are fine — after a month ArthMitra compares them with what you really spent.</p>
                <div className="grid grid-cols-2 gap-3">
                  {variableCats.map((c) => (
                    <AmountInput
                      key={c.id}
                      label={c.name}
                      valuePaise={estimates[c.id] ?? null}
                      onChange={(p) => setEstimates({ ...estimates, [c.id]: p ?? 0 })}
                    />
                  ))}
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <fieldset>
                  <legend className="mb-2 text-sm font-medium">What are you saving for?</legend>
                  <div className="flex flex-wrap gap-2">
                    {GOAL_KINDS.map((g) => (
                      <Chip
                        key={g.kind}
                        icon={g.icon}
                        selected={kind === g.kind}
                        onClick={() => {
                          setKind(g.kind);
                          setGoalName(g.kind === "car" ? "Car down payment" : g.kind === "custom" ? "" : g.label);
                        }}
                      >
                        {g.label}
                      </Chip>
                    ))}
                  </div>
                </fieldset>
                <TextInput label="Goal name" value={goalName} onChange={(e) => setGoalName(e.target.value)} maxLength={60} />
                <AmountInput label="Target amount" valuePaise={target} onChange={setTarget} />
                <TextInput label="Target date" type="date" min={addMonths(today, 1)} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
                <fieldset>
                  <legend className="mb-2 text-sm font-medium">How do you feel about ups and downs?</legend>
                  <div className="grid grid-cols-3 gap-2">
                    {RISK.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        aria-pressed={risk === r.value}
                        onClick={() => setRisk(r.value)}
                        className={cx(
                          "rounded-2xl border p-3 text-left",
                          risk === r.value ? "border-primary bg-primary/8" : "border-outline-variant hover:bg-on-surface/5",
                        )}
                      >
                        <span className="block text-sm font-semibold">{r.label}</span>
                        <span className="text-xs text-on-surface-variant">{r.text}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              </>
            )}

            {step === 5 && (
              <>
                <div className="rounded-2xl bg-primary-container p-5 text-on-primary-container">
                  <p className="text-sm">You can save about</p>
                  <p className={cx("text-4xl font-bold tabular-nums", capacity < 0 && "text-error")}>{formatINR(capacity)}</p>
                  <p className="text-sm">a month = income − fixed costs − estimated spending</p>
                </div>
                <p className="text-sm text-on-surface-variant">
                  Goal: <strong className="text-on-surface">{goalName}</strong>, {formatINR(target ?? 0)} by {formatDate(targetDate)}. You&apos;ll see the
                  monthly amount and a date once your bank is linked.
                </p>
                <div className="rounded-2xl border border-outline-variant p-4">
                  <Toggle
                    label="Let Gemini help sort payments and read bills"
                    description="Sends merchant text, amounts, bill photos and totals — never your name or account numbers. You can turn it off any time in Settings."
                    checked={aiConsent}
                    onChange={setAiConsent}
                  />
                </div>
              </>
            )}

            <div className="flex justify-between gap-3 pt-2">
              <Button variant="text" icon="arrow_back" className="px-3 sm:px-5" disabled={step === 0} onClick={() => setStep(step - 1)}>
                Back
              </Button>
              <button
                type="submit"
                disabled={!canContinue}
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary disabled:bg-on-surface/12 disabled:text-on-surface/40 sm:px-6"
              >
                {step === STEPS.length - 1 ? (data.accounts.length ? "Save" : "Link a bank") : "Continue"}
                <Icon name="arrow_forward" className="text-[20px]" />
              </button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
}
