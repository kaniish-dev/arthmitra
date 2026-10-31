"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { formatDate, formatINR, todayIso, type StatementRow } from "@arthmitra/engine";
import type { Guardian, Transaction } from "@arthmitra/schema";
import { completeSignup, type SignupInput } from "@/lib/actions";
import { authEnabled, logOut, useAuth } from "@/lib/auth";
import { COMPLIANCE } from "@/lib/constants";
import { aadhaarError, aadhaarLast4, ageOn, maskPan, panError, showAadhaar } from "@/lib/id-check";
import { demoPersona, demoValues, sampleStatementCsv } from "@/lib/demo";
import { pendingMobile } from "@/lib/pending-mobile";
import { aa, type AaConsentSummary } from "@/lib/services/aa";
import { accountNumberError, bank, type IfscInfo } from "@/lib/services/bank";
import { kyc } from "@/lib/services/kyc";
import { STATEMENT_ACCEPT, readStatementFile } from "@/lib/statement-file";
import { useAppData } from "@/lib/store";
import { AutofillButton, Button, Card, DemoBadge, Icon, Loading, Modal, Note, Select, TextInput, cx, fieldClass } from "@/components/ui";

const MOBILE = /^[6-9]\d{9}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RELATIONS: Array<{ value: Guardian["relation"]; label: string }> = [
  { value: "mother", label: "Mother" },
  { value: "father", label: "Father" },
  { value: "legal_guardian", label: "Legal guardian" },
];

type Step = 1 | 2 | 3;

/**
 * Sign-up in three steps, as in the workflow: (1) basic details — date of birth decides the
 * KYC path; (2) KYC — own PAN + Aadhaar at 18+, the guardian's below 18; (3) link a bank
 * account and bring in history through Account Aggregator consent or a statement upload.
 */
export function SetupScreen() {
  const router = useRouter();
  const auth = useAuth();
  const data = useAppData();
  const mustLogIn = authEnabled && auth.status === "signedOut";
  const done = Boolean(data?.registration);

  useEffect(() => {
    if (mustLogIn) router.replace("/");
    else if (done) router.replace("/dashboard");
  }, [mustLogIn, done, router]);

  if (data === null || auth.status === "loading" || mustLogIn || done) return <Loading />;
  const account = auth.status === "signedIn" ? auth.account : null;
  const phone = account?.phone?.replace(/^\+91/, "") ?? "";
  return <SetupForm initialName={account?.name ?? ""} initialEmail={account?.email ?? ""} initialMobile={phone || pendingMobile()} mobileLocked={Boolean(phone)} />;
}

function SetupForm({ initialName, initialEmail, initialMobile, mobileLocked }: { initialName: string; initialEmail: string; initialMobile: string; mobileLocked: boolean }) {
  const router = useRouter();
  const today = todayIso();
  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [name, setName] = useState(initialName);
  const [dob, setDob] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [mobile, setMobile] = useState(initialMobile);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const age = dob ? ageOn(dob, today) : null;
  const isMinor = age !== null && age < 18;

  // Step 2
  const [guardianName, setGuardianName] = useState("");
  const [relation, setRelation] = useState<Guardian["relation"]>("mother");
  const [pan, setPan] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState<{ panMasked: string; aadhaarLast4: string } | null>(null);

  const next1 = (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!name.trim()) err.name = "Enter your full name.";
    if (!dob) err.dob = "Enter your date of birth.";
    else if (age! < 10 || age! > 100 || dob > today) err.dob = "Check the date of birth — ArthMitra is for ages 10 and up.";
    if (email.trim() && !EMAIL.test(email.trim())) err.email = "That email doesn't look right.";
    if (!MOBILE.test(mobile)) err.mobile = "Enter a 10-digit mobile number starting with 6, 7, 8 or 9.";
    setErrors(err);
    if (Object.keys(err).length === 0) setStep(2);
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (isMinor && !guardianName.trim()) err.guardianName = "Enter your guardian's name.";
    const p = panError(pan);
    const a = aadhaarError(aadhaar);
    if (p) err.pan = p;
    if (a) err.aadhaar = a;
    setErrors(err);
    if (Object.keys(err).length) return;
    setVerifying(true);
    const result = await kyc.verify({ pan, aadhaar, name: isMinor ? guardianName : name });
    setVerifying(false);
    if (result.status !== "verified") return setErrors({ pan: result.reason ?? "Couldn't verify. Check the numbers." });
    // Raw numbers are cleared as soon as they are verified.
    setPan("");
    setAadhaar("");
    setVerified({ panMasked: result.panMasked, aadhaarLast4: result.aadhaarLast4 });
  };

  return (
    <div className="min-h-screen bg-surface-container-low">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-outline-variant/40 bg-surface/90 px-4 py-3 backdrop-blur md:px-8">
        <span className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-on-primary">
            <Icon name="currency_rupee" />
          </span>
          <span className="text-lg font-bold tracking-tight">ArthMitra</span>
        </span>
        <span className="flex items-center gap-2">
          <DemoBadge />
          <Button
            variant="text"
            className="px-3 py-2"
            onClick={async () => {
              if (authEnabled) await logOut();
              router.push("/");
            }}
          >
            {authEnabled ? "Log out" : "Exit"}
          </Button>
        </span>
      </header>

      <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-6 md:py-10">
        <Stepper step={step} labels={["Basic details", isMinor ? "Guardian KYC" : "KYC", "Link bank"]} />

        {step === 1 && (
          <Card as="div">
            <form onSubmit={next1} className="flex flex-col gap-4" noValidate>
              <Heading title="Tell us about you" text="Your date of birth decides how KYC works for you." />
              <AutofillButton
                label={`Autofill as ${demoValues().basic.name.split(" ")[0]}${demoPersona() ? "" : " (demo)"}`}
                onClick={() => {
                  const v = demoValues().basic;
                  setName(v.name);
                  setDob(v.dob);
                  setEmail(v.email);
                  if (!mobileLocked) setMobile(v.mobile);
                }}
              />
              <TextInput label="Full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} />
              <FieldError message={errors.name} />
              <TextInput
                label="Date of birth"
                type="date"
                value={dob}
                max={today}
                onChange={(e) => setDob(e.target.value)}
                hint={age !== null && age >= 10 ? (isMinor ? `You're ${age}. A parent or guardian completes KYC and your account is linked to them.` : `You're ${age}. You'll complete your own KYC.`) : "DD MMM YYYY"}
              />
              <FieldError message={errors.dob} />
              <TextInput label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" hint="Optional — for monthly summaries." />
              <FieldError message={errors.email} />
              <MobileInput value={mobile} onChange={setMobile} disabled={mobileLocked} hint={mobileLocked ? "Verified with OTP at login." : undefined} />
              <FieldError message={errors.mobile} />
              <Button type="submit" icon="arrow_forward" className="mt-2 h-12">
                Continue
              </Button>
            </form>
          </Card>
        )}

        {step === 2 && (
          <Card as="div">
            <form onSubmit={verify} className="flex flex-col gap-4" noValidate>
              <Heading
                title={isMinor ? "Guardian KYC" : "Verify your identity"}
                text={isMinor ? "You're under 18, so your parent or guardian verifies with their PAN and Aadhaar. Either of you can invest on a third-party app; ArthMitra only tracks." : "Your PAN and Aadhaar, checked once. We keep only masked numbers."}
              />
              {isMinor && (
                <>
                  <TextInput label="Guardian's full name" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} disabled={Boolean(verified)} maxLength={60} />
                  <FieldError message={errors.guardianName} />
                  <Select label="Relationship to you" value={relation} onChange={(v) => setRelation(v as Guardian["relation"])} options={RELATIONS} />
                </>
              )}
              {verified ? (
                <div role="status" className="flex items-center gap-3 rounded-2xl bg-success-container px-4 py-3">
                  <Icon name="verified" filled className="text-2xl text-success" />
                  <div className="text-sm">
                    <p className="font-semibold">Verified{isMinor ? ` — ${guardianName.trim()}` : ""}</p>
                    <p className="text-on-surface-variant">
                      PAN {verified.panMasked} · Aadhaar {showAadhaar(verified.aadhaarLast4)}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <TextInput
                    label={isMinor ? "Guardian's PAN" : "PAN"}
                    value={pan}
                    onChange={(e) => setPan(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))}
                    placeholder="ABCDE1234F"
                    autoComplete="off"
                    hint={pan && !panError(pan) ? `Stored as ${maskPan(pan)}` : "Format AAAAA9999A"}
                  />
                  <FieldError message={errors.pan} />
                  <TextInput
                    label={isMinor ? "Guardian's Aadhaar" : "Aadhaar number"}
                    value={aadhaar}
                    inputMode="numeric"
                    onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, "").slice(0, 12))}
                    placeholder="12 digits"
                    autoComplete="off"
                    hint={aadhaar && !aadhaarError(aadhaar) ? `Stored as ${showAadhaar(aadhaarLast4(aadhaar))}` : "12 digits. Only the last 4 are kept."}
                  />
                  <FieldError message={errors.aadhaar} />
                  <AutofillButton
                    onClick={() => {
                      const v = demoValues(isMinor ? "minor" : "adult").kyc;
                      setPan(v.pan);
                      setAadhaar(v.aadhaar);
                      if (isMinor) {
                        setGuardianName(v.guardianName);
                        setRelation(v.relation);
                      }
                    }}
                  />
                </>
              )}
              <Note>
                {COMPLIANCE.kyc} <DemoBadge label="Mock verification" />
              </Note>
              <div className="mt-2 flex gap-2">
                <Button variant="text" icon="arrow_back" onClick={() => setStep(1)} className="h-12">
                  Back
                </Button>
                {verified ? (
                  <Button icon="arrow_forward" className="h-12 flex-1" onClick={() => setStep(3)}>
                    Continue to bank
                  </Button>
                ) : (
                  <Button type="submit" disabled={verifying} className="h-12 flex-1">
                    {verifying ? (
                      <>
                        <Icon name="progress_activity" className="animate-spin text-[20px]" /> Verifying with KYC provider…
                      </>
                    ) : (
                      "Verify"
                    )}
                  </Button>
                )}
              </div>
            </form>
          </Card>
        )}

        {step === 3 && verified && (
          <BankStep
            defaultHolder={name.trim()}
            isMinor={isMinor}
            onBack={() => setStep(2)}
            onDone={(bankDetails, history) => {
              const input: SignupInput = {
                name: name.trim(),
                dob,
                email: email.trim() || null,
                mobile,
                isMinor,
                kyc: verified,
                guardian: isMinor ? { name: guardianName.trim(), relation } : null,
                bank: bankDetails,
                history,
              };
              completeSignup(input);
              router.replace("/dashboard");
            }}
          />
        )}
      </main>
    </div>
  );
}

function BankStep({
  defaultHolder,
  isMinor,
  onBack,
  onDone,
}: {
  defaultHolder: string;
  isMinor: boolean;
  onBack: () => void;
  onDone: (bank: SignupInput["bank"], history: SignupInput["history"]) => void;
}) {
  const [holder, setHolder] = useState(defaultHolder);
  const [number, setNumber] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [info, setInfo] = useState<IfscInfo | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<"aa" | "statement" | null>(null);

  useEffect(() => {
    let live = true;
    void bank.lookupIfsc(ifsc).then((r) => live && setInfo(r));
    return () => {
      live = false;
    };
  }, [ifsc]);

  const details = (): SignupInput["bank"] | null => {
    const err: Record<string, string> = {};
    if (!holder.trim()) err.holder = "Enter the name on the account.";
    const n = accountNumberError(number);
    if (n) err.number = n;
    else if (confirm !== number) err.confirm = "The two account numbers don't match.";
    if (!info) err.ifsc = "Enter a valid IFSC, like HDFC0001234 (4 letters, 0, then 6 letters or digits).";
    setErrors(err);
    if (Object.keys(err).length || !info) return null;
    return { holderName: holder.trim(), accountLast4: number.slice(-4), ifsc: info.ifsc, bankName: info.bank, branch: info.branch };
  };

  const choose = (m: "aa" | "statement") => {
    if (details()) setMethod(m);
  };

  return (
    <Card as="div" className="flex flex-col gap-4">
      <Heading title="Link your bank account" text="Account details first, then bring in your transaction history — that's how we work out a realistic saving." />
      <TextInput label="Account holder name" value={holder} onChange={(e) => setHolder(e.target.value)} maxLength={80} hint={isMinor ? "A minor's savings account your guardian approved." : undefined} />
      <FieldError message={errors.holder} />
      <TextInput label="Account number" value={number} inputMode="numeric" type="password" autoComplete="off" onChange={(e) => setNumber(e.target.value.replace(/\D/g, "").slice(0, 18))} />
      <FieldError message={errors.number} />
      <TextInput
        label="Confirm account number"
        value={confirm}
        inputMode="numeric"
        autoComplete="off"
        onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 18))}
        hint={number.length >= 4 ? `Only the last 4 digits (…${number.slice(-4)}) are stored.` : undefined}
        onPaste={(e) => e.preventDefault()}
      />
      <FieldError message={errors.confirm} />
      <TextInput
        label="IFSC"
        value={ifsc}
        onChange={(e) => setIfsc(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11))}
        placeholder="HDFC0001234"
        autoComplete="off"
        hint={info ? undefined : "Printed on your cheque book or passbook."}
      />
      {info && (
        <p role="status" className="-mt-2 flex items-center gap-2 text-sm">
          <Icon name="account_balance" className="text-primary" />
          <span>
            <strong>{info.bank}</strong> · {info.branch}
          </span>
          <DemoBadge label="Mock lookup" />
        </p>
      )}
      <FieldError message={errors.ifsc} />
      <AutofillButton
        onClick={() => {
          const v = demoValues(isMinor ? "minor" : "adult").bank;
          setHolder(v.holder);
          setNumber(v.number);
          setConfirm(v.number);
          setIfsc(v.ifsc);
        }}
      />

      <h3 className="mt-2 text-base font-semibold">Bring in your transaction history</h3>
      <p className="-mt-3 text-sm text-on-surface-variant">Account number and IFSC alone don&apos;t give history. Pick one:</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ChoiceButton icon="verified_user" title="Account Aggregator" text="RBI-regulated consent. 6–12 months, then automatic updates." onClick={() => choose("aa")} />
        <ChoiceButton icon="upload_file" title="Upload a statement" text="CSV, Excel or PDF from net banking. Read on your device." onClick={() => choose("statement")} />
      </div>
      <Note icon="account_balance">
        {COMPLIANCE.bank} <DemoBadge />
      </Note>
      <Button variant="text" icon="arrow_back" onClick={onBack} className="h-12 w-fit">
        Back
      </Button>

      {method === "aa" && (
        <AaConsentModal
          isMinor={isMinor}
          onClose={() => setMethod(null)}
          onApproved={(txns, summary) => onDone(details()!, { source: "aa", txns, consent: summary.detail })}
        />
      )}
      {method === "statement" && (
        <StatementModal isMinor={isMinor} onClose={() => setMethod(null)} onRows={(rows) => onDone(details()!, { source: "statement", rows })} />
      )}
    </Card>
  );
}

/** Mock AA consent screen: what data, for how long, the purpose, approve or deny. */
function AaConsentModal({ isMinor, onClose, onApproved }: { isMinor: boolean; onClose: () => void; onApproved: (txns: Transaction[], summary: AaConsentSummary) => void }) {
  const [months, setMonths] = useState(isMinor ? 6 : 9);
  const [fetching, setFetching] = useState(false);
  const summary = aa.consentFor(months);
  const approve = async () => {
    setFetching(true);
    const txns = await aa.fetchHistory({ accountId: "pending", months, kind: isMinor ? "student" : "salaried" });
    onApproved(txns, summary);
  };
  return (
    <Modal open onClose={fetching ? () => {} : onClose} title={`Consent request · ${summary.aaName}`}>
      <div className="flex flex-col gap-4 text-sm">
        <p className="flex items-center gap-2">
          <DemoBadge label="Mock Account Aggregator" />
        </p>
        <dl className="flex flex-col gap-3">
          <ConsentRow icon="description" label="What data" value={summary.what} />
          <ConsentRow icon="schedule" label="For how long" value={summary.howLong} />
          <ConsentRow icon="target" label="Purpose" value={summary.purpose} />
          <ConsentRow icon="event" label="Consent valid until" value={formatDate(summary.detail.consentExpiry.slice(0, 10))} />
        </dl>
        <fieldset>
          <legend className="mb-2 font-medium">History to share</legend>
          <div className="flex gap-2">
            {[6, 9, 12].map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={months === m}
                onClick={() => setMonths(m)}
                className={cx("rounded-full border px-4 py-1.5 font-medium", months === m ? "border-primary bg-primary-container text-on-primary-container" : "border-outline")}
              >
                {m} months
              </button>
            ))}
          </div>
        </fieldset>
        <div className="flex gap-2">
          <Button variant="outlined" className="h-12 flex-1" onClick={onClose} disabled={fetching}>
            Deny
          </Button>
          <Button className="h-12 flex-1" onClick={approve} disabled={fetching}>
            {fetching ? (
              <>
                <Icon name="progress_activity" className="animate-spin text-[20px]" /> Fetching…
              </>
            ) : (
              "Approve"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ConsentRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <Icon name={icon} className="text-primary" />
      <div>
        <dt className="text-xs font-semibold tracking-wide text-on-surface-variant uppercase">{label}</dt>
        <dd>{value}</dd>
      </div>
    </div>
  );
}

/** Statement upload: real CSV / Excel / text-PDF parsing; a PDF that can't be read falls back to labelled sample rows. */
function StatementModal({ isMinor, onClose, onRows }: { isMinor: boolean; onClose: () => void; onRows: (rows: StatementRow[]) => void }) {
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ rows: StatementRow[]; sample: boolean } | null>(null);

  const read = async (picked: File | null = file) => {
    if (!picked) return setProblem("Choose a statement file.");
    const file = picked;
    setBusy(true);
    setProblem(null);
    const r = await readStatementFile(file, password || undefined);
    setBusy(false);
    if (r.ok && r.rows.length) return setPreview({ rows: r.rows, sample: false });
    if (!r.ok && r.needsPassword) {
      setNeedsPassword(true);
      return setProblem(r.error);
    }
    if (file.name.toLowerCase().endsWith(".pdf")) {
      // Demo: a PDF layout we can't read yet returns sample rows, clearly labelled.
      const txns = await aa.fetchHistory({ accountId: "statement", months: 6, kind: isMinor ? "student" : "salaried" });
      return setPreview({ rows: txns.map((t) => ({ date: t.date, description: t.merchantRaw, amountPaise: t.amountPaise, reference: t.id })), sample: true });
    }
    setProblem(r.ok ? "No transactions found in this file." : r.error);
  };

  return (
    <Modal open onClose={onClose} title="Upload a bank statement">
      <div className="flex flex-col gap-4 text-sm">
        {!preview ? (
          <>
            <p className="text-on-surface-variant">The file is read in your browser and never uploaded. CSV and Excel are parsed fully; text PDFs too, where the layout allows.</p>
            <label htmlFor={inputId} className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-outline-variant px-4 py-6 text-center hover:bg-on-surface/4">
              <Icon name="upload_file" className="text-3xl text-primary" />
              <span className="font-semibold">{file ? file.name : "Choose CSV, Excel or PDF"}</span>
              <input id={inputId} type="file" accept={STATEMENT_ACCEPT} className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            {needsPassword && (
              <input type="password" className={fieldClass} placeholder="PDF password" aria-label="PDF password" value={password} onChange={(e) => setPassword(e.target.value)} />
            )}
            <FieldError message={problem} />
            <Button className="h-12" onClick={() => read()} disabled={busy || !file}>
              {busy ? "Reading…" : "Read statement"}
            </Button>
            <AutofillButton
              label="Autofill: use a sample CSV statement"
              onClick={() => {
                // A real CSV file run through the same parser as an upload.
                const sample = new File([sampleStatementCsv(isMinor ? "minor" : "adult")], "sample-statement.csv", { type: "text/csv" });
                setFile(sample);
                void read(sample);
              }}
            />
          </>
        ) : (
          <>
            <p className="flex items-center gap-2 font-semibold">
              <Icon name="task_alt" className="text-success" /> {preview.rows.length} transactions found
              {preview.sample && <DemoBadge label="Sample rows for this PDF" />}
            </p>
            <ul className="max-h-56 divide-y divide-outline-variant/50 overflow-y-auto rounded-2xl border border-outline-variant/60">
              {preview.rows.slice(0, 8).map((r, i) => (
                <li key={i} className="flex justify-between gap-3 px-3 py-2">
                  <span className="min-w-0 truncate">
                    <span className="text-on-surface-variant">{formatDate(r.date)}</span> · {r.description}
                  </span>
                  <span className={cx("shrink-0 tabular-nums", r.amountPaise > 0 && "text-success")}>{formatINR(r.amountPaise, { signed: true })}</span>
                </li>
              ))}
            </ul>
            <Button className="h-12" icon="check" onClick={() => onRows(preview.rows)}>
              Use these and finish
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}

function ChoiceButton({ icon, title, text, onClick }: { icon: string; title: string; text: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col gap-1 rounded-2xl border border-outline-variant p-4 text-left hover:border-primary hover:bg-primary/4">
      <Icon name={icon} className="text-2xl text-primary" />
      <span className="font-semibold">{title}</span>
      <span className="text-xs text-on-surface-variant">{text}</span>
    </button>
  );
}

function Stepper({ step, labels }: { step: Step; labels: [string, string, string] }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Sign-up steps">
      {labels.map((label, i) => {
        const n = (i + 1) as Step;
        const state = n < step ? "done" : n === step ? "current" : "next";
        return (
          <li key={label} aria-current={state === "current" ? "step" : undefined} className="flex flex-1 items-center gap-2">
            <span
              className={cx(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                state === "next" ? "bg-surface-container-highest text-on-surface-variant" : "bg-primary text-on-primary",
              )}
            >
              {state === "done" ? <Icon name="check" className="text-[16px]" /> : n}
            </span>
            <span className={cx("truncate text-xs font-medium sm:text-sm", state === "next" && "text-on-surface-variant")}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Heading({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-on-surface-variant">{text}</p>
    </div>
  );
}

function MobileInput({ value, onChange, disabled, hint }: { value: string; onChange: (v: string) => void; disabled?: boolean; hint?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        Mobile
      </label>
      <div className="flex">
        <span className="flex items-center rounded-l-xl border border-r-0 border-outline bg-surface-container px-3 text-base text-on-surface-variant">+91</span>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="98765 43210"
          className={cx(fieldClass, "rounded-l-none tracking-wide disabled:opacity-60")}
        />
      </div>
      {hint && <p className="text-xs text-on-surface-variant">{hint}</p>}
    </div>
  );
}

function FieldError({ message }: { message: string | null | undefined }): ReactNode {
  if (!message) return null;
  return (
    <p role="alert" className="-mt-2 flex items-center gap-1 text-xs font-medium text-error">
      <Icon name="error" className="text-[16px]" />
      {message}
    </p>
  );
}

