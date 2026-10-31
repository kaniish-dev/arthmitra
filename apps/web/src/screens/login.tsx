"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import type { ConfirmationResult } from "firebase/auth";
import { PERSONAS, type PersonaId } from "@arthmitra/seed";
import { startFresh, startPersona } from "@/lib/actions";
import {
  authEnabled,
  authErrorMessage,
  confirmPhoneOtp,
  demoEnabled,
  logIn,
  logInAsPersona,
  logInWithGoogle,
  resetPassword,
  sendPhoneOtp,
  signUp,
  useAuth,
} from "@/lib/auth";
import { checkOtp, sendOtp, type OtpSession } from "@/lib/otp";
import { demoValues, setDemoPersona } from "@/lib/demo";
import { rememberMobile } from "@/lib/pending-mobile";
import { useAppData } from "@/lib/store";
import { Button, DemoBadge, Icon, Loading, TextInput, cx, fieldClass } from "@/components/ui";

type Mode = "phone" | "login" | "signup" | "reset";

const COPY: Record<Mode, { title: string; text: string }> = {
  phone: { title: "Namaste! Let's get you in", text: "Log in or sign up with your mobile number. Takes 30 seconds." },
  login: { title: "Log in with email", text: "For accounts created with an email and password." },
  signup: { title: "Sign up with email", text: "Prefer email? Create an account, then three quick steps." },
  reset: { title: "Reset your password", text: "Enter your account email and we'll send you a link to set a new password." },
};

const HIGHLIGHTS = [
  { icon: "insights", title: "Know your real saving", text: "Reads your past spends and sets a monthly saving you can actually hit." },
  { icon: "flag", title: "Plan a Big Day or build wealth", text: "Car, wedding, dream trip — or passive income that pays your bills." },
  { icon: "forum", title: "Mitra, an AI coach that knows your numbers", text: "Ask anything, in English or हिंदी." },
];

const MOBILE = /^[6-9]\d{9}$/;

/**
 * Login and sign-up: mobile OTP (Firebase phone auth) or Google, with email as a fallback,
 * plus one-tap demo logins for both KYC paths. Without Firebase keys everything runs as a
 * local demo, with the OTP shown on screen.
 */
export function AuthScreen({ initialMode }: { initialMode: "login" | "signup" }) {
  const router = useRouter();
  const auth = useAuth();
  const data = useAppData();
  const [mode, setMode] = useState<Mode>(initialMode === "signup" ? "phone" : "phone");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"email" | "google" | "phone" | PersonaId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Once signed in and loaded: new accounts finish the sign-up steps first.
  const signedIn = auth.status === "signedIn" && data !== null;
  useEffect(() => {
    if (signedIn) router.replace(data!.registration ? "/dashboard" : "/setup");
  }, [signedIn, data, router]);

  const run = async (kind: NonNullable<typeof busy>, task: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === "reset") {
      void run("email", async () => {
        await resetPassword(email.trim());
        setSent(true);
      });
    } else if (mode === "signup") {
      void run("email", () => signUp(name.trim(), email.trim(), password));
    } else {
      void run("email", () => logIn(email.trim(), password));
    }
  };

  const switchTo = (next: Mode) => {
    setMode(next);
    setError(null);
    setSent(false);
  };

  /** Walk-through starts an empty account at sign-up with autofill on every step; ready skips to the seeded account. */
  const persona = (id: PersonaId, ready: boolean) => {
    setDemoPersona(id);
    if (authEnabled) return void run(id, () => logInAsPersona(id, ready));
    if (ready) {
      startPersona(id);
      router.push("/dashboard");
    } else {
      startFresh();
      rememberMobile(demoValues(id).basic.mobile);
      router.push("/setup");
    }
  };
  const showPersonas = !authEnabled || demoEnabled;

  if (auth.status === "loading" || signedIn) return <Loading />;

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <BrandPanel />

      <main className="flex flex-col px-4 py-6 sm:px-8 lg:px-16">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 lg:hidden">
            <Logo />
            <span className="text-lg font-bold tracking-tight">ArthMitra</span>
          </Link>
          <DemoBadge label="Demo mode · KYC, bank and investments are mocked" />
        </div>

        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-10">
          {mode !== "phone" && (
            <button
              type="button"
              onClick={() => switchTo(mode === "reset" ? "login" : "phone")}
              className="mb-6 flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <Icon name="arrow_back" className="text-[18px]" />
              {mode === "reset" ? "Back to log in" : "Use mobile number instead"}
            </button>
          )}

          <h1 className="text-[28px] leading-tight font-semibold tracking-tight">{COPY[mode].title}</h1>
          <p className="mt-2 text-on-surface-variant">{COPY[mode].text}</p>

          {mode === "phone" && (
            <PhoneLogin
              disabled={busy !== null}
              onError={setError}
              onLocalVerified={(mobile) => {
                rememberMobile(mobile);
                startFresh();
                router.push("/setup");
              }}
            />
          )}

          {authEnabled && (mode === "phone" || mode === "login" || mode === "signup") && (
            <>
              <div className="my-6 flex items-center gap-3 text-xs font-medium text-on-surface-variant">
                <span className="h-px flex-1 bg-outline-variant" />
                OR
                <span className="h-px flex-1 bg-outline-variant" />
              </div>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void run("google", logInWithGoogle)}
                className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-outline bg-surface-container-lowest text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container disabled:opacity-60"
              >
                {busy === "google" ? <Spinner /> : <GoogleLogo />}
                Continue with Google
              </button>
            </>
          )}

          {authEnabled && mode !== "phone" && (
            <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
              {mode === "signup" && <TextInput label="Full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} required />}
              <TextInput label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required />
              {mode !== "reset" && (
                <PasswordInput
                  label="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  minLength={mode === "signup" ? 8 : undefined}
                  hint={mode === "signup" ? "At least 8 characters." : undefined}
                  action={
                    mode === "login" && (
                      <button type="button" onClick={() => switchTo("reset")} className="text-sm font-medium text-primary hover:underline">
                        Forgot password?
                      </button>
                    )
                  }
                  required
                />
              )}
              {sent && (
                <p role="status" className="flex items-start gap-2 rounded-xl bg-success-container px-3 py-2.5 text-sm text-on-surface">
                  <Icon name="mark_email_read" className="text-[20px] text-success" />
                  <span>If an account uses {email.trim()}, a reset link is on its way. Check your spam folder too.</span>
                </p>
              )}
              <Button type="submit" disabled={busy !== null} className="h-12 w-full">
                {busy === "email" && <Spinner />}
                {mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Log in"}
              </Button>
              {mode !== "reset" && (
                <p className="text-center text-sm text-on-surface-variant">
                  {mode === "login" ? "No email account yet? " : "Already have one? "}
                  <button type="button" onClick={() => switchTo(mode === "login" ? "signup" : "login")} className="font-semibold text-primary hover:underline">
                    {mode === "login" ? "Sign up with email" : "Log in"}
                  </button>
                </p>
              )}
            </form>
          )}

          {error && (
            <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-error-container px-3 py-2.5 text-sm text-on-error-container">
              <Icon name="error" className="text-[20px]" />
              <span>{error}</span>
            </p>
          )}

          {authEnabled && mode === "phone" && (
            <p className="mt-4 text-center text-sm text-on-surface-variant">
              Prefer email?{" "}
              <button type="button" onClick={() => switchTo("login")} className="font-semibold text-primary hover:underline">
                Use email and password
              </button>
            </p>
          )}

          {showPersonas && mode === "phone" && (
            <section aria-labelledby="demo-logins" className="mt-8">
              <h2 id="demo-logins" className="mb-1 text-xs font-semibold tracking-wide text-on-surface-variant uppercase">
                Demo logins
              </h2>
              <p className="mb-2 text-xs text-on-surface-variant">Walk through every step with Autofill on each form, or jump to an account that is already set up.</p>
              <div className="flex flex-col gap-2">
                {(Object.keys(PERSONAS) as PersonaId[]).map((id) => (
                  <div key={id} className="rounded-2xl border border-dashed border-outline-variant px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-tertiary-container text-tertiary">
                        {busy === id ? <Spinner /> : <Icon name={id === "adult" ? "work" : "family_restroom"} className="text-[20px]" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{PERSONAS[id].label}</span>
                        <span className="block text-xs text-on-surface-variant">{id === "adult" ? "Own KYC with PAN + Aadhaar" : "Guardian KYC by her mother"}</span>
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button icon="route" className="px-4 py-2" disabled={busy !== null} onClick={() => persona(id, false)}>
                        Walk through every step
                      </Button>
                      <Button variant="text" icon="fast_forward" className="px-3 py-2" disabled={busy !== null} onClick={() => persona(id, true)}>
                        Skip to ready account
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-on-surface-variant">
          <Icon name="lock" className="text-[16px]" />
          ArthMitra never asks for your UPI PIN or bank password, and never holds your money.
        </p>
      </main>
    </div>
  );
}

/**
 * Mobile number → OTP. With Firebase, a real SMS (or a console test number); without it,
 * a demo OTP shown on screen.
 */
function PhoneLogin({ disabled, onError, onLocalVerified }: { disabled: boolean; onError: (e: string | null) => void; onLocalVerified: (mobile: string) => void }) {
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [demo, setDemo] = useState<OtpSession | null>(null);
  const mobileId = useId();
  const recaptchaId = "recaptcha-box";
  const sentTo = confirmation || demo ? mobile : null;

  const send = async (e: FormEvent) => {
    e.preventDefault();
    onError(null);
    if (!MOBILE.test(mobile)) return onError("Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9.");
    if (!authEnabled) {
      setDemo(sendOtp());
      return;
    }
    setBusy(true);
    try {
      setConfirmation(await sendPhoneOtp(mobile, recaptchaId));
    } catch (err) {
      onError(authErrorMessage(err, "phone"));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    onError(null);
    if (!/^\d{6}$/.test(code)) return onError("Enter the 6-digit OTP.");
    if (demo) {
      const { result, session } = checkOtp(demo, code);
      setDemo(session);
      if (result === "ok") return onLocalVerified(mobile);
      return onError(result === "wrong" ? "That OTP is wrong." : result === "expired" ? "That OTP has expired. Send a new one." : "Too many tries. Send a new OTP.");
    }
    if (!confirmation) return;
    setBusy(true);
    try {
      await confirmPhoneOtp(confirmation, code);
    } catch (err) {
      onError(authErrorMessage(err, "phone"));
      setBusy(false);
    }
  };

  return (
    <div className="mt-8">
      {!sentTo ? (
        <form onSubmit={send} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={mobileId} className="text-sm font-medium">
              Mobile number
            </label>
            <div className="flex">
              <span className="flex items-center rounded-l-xl border border-r-0 border-outline bg-surface-container px-3 text-sm font-medium">+91</span>
              <input
                id={mobileId}
                inputMode="numeric"
                autoComplete="tel-national"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="98765 43210"
                className={cx(fieldClass, "rounded-l-none")}
                required
              />
            </div>
          </div>
          <Button type="submit" disabled={disabled || busy} className="h-12 w-full">
            {busy && <Spinner />}
            Send OTP
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-4">
          <p className="text-sm text-on-surface-variant">
            OTP sent to <strong className="text-on-surface">+91 {mobile}</strong>.{" "}
            <button
              type="button"
              className="font-semibold text-primary hover:underline"
              onClick={() => {
                setConfirmation(null);
                setDemo(null);
                setCode("");
              }}
            >
              Change
            </button>
          </p>
          {demo && (
            <p role="status" className="flex items-center gap-2 rounded-2xl bg-warning-container px-3 py-2.5 text-sm text-on-warning-container">
              <Icon name="sms" className="text-[20px]" />
              <span className="flex-1">
                Demo SMS: your ArthMitra OTP is <strong className="tracking-widest tabular-nums">{demo.code}</strong>
              </span>
              <button type="button" onClick={() => setCode(demo.code)} className="font-semibold underline">
                Fill
              </button>
            </p>
          )}
          <TextInput
            label="6-digit OTP"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            autoFocus
          />
          <Button type="submit" disabled={disabled || busy} className="h-12 w-full">
            {busy && <Spinner />}
            Verify and continue
          </Button>
        </form>
      )}
      <div id={recaptchaId} />
    </div>
  );
}

function BrandPanel() {
  return (
    <aside className="hero relative hidden overflow-hidden bg-linear-to-br from-primary to-[#062e6f] p-12 text-on-primary lg:flex lg:flex-col">
      <div aria-hidden className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/10" />
      <div aria-hidden className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/5" />
      <Link href="/" className="relative flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-primary">
          <Icon name="currency_rupee" />
        </span>
        <span className="text-xl font-bold tracking-tight">ArthMitra</span>
      </Link>
      <div className="relative my-auto max-w-md">
        <h2 className="text-4xl leading-tight font-semibold tracking-tight">
          Har Kharch Ka Hisaab,
          <br />
          Har Sapne Ka Plan.
        </h2>
        <ul className="mt-10 flex flex-col gap-6">
          {HIGHLIGHTS.map((h) => (
            <li key={h.title} className="flex gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                <Icon name={h.icon} />
              </span>
              <span>
                <span className="block font-semibold">{h.title}</span>
                <span className="block text-sm text-on-primary/80">{h.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="relative text-xs text-on-primary/70">Educational guidance, not investment advice. ArthMitra plans, redirects and tracks — it never holds money or places trades.</p>
    </aside>
  );
}

function Logo() {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-on-primary">
      <Icon name="currency_rupee" />
    </span>
  );
}

function PasswordInput({
  label,
  hint,
  action,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; action?: ReactNode }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-on-surface">
          {label}
        </label>
        {action}
      </div>
      <div className="relative">
        <input id={id} type={visible ? "text" : "password"} className={cx(fieldClass, "pr-12")} {...props} />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1.5 text-on-surface-variant hover:bg-on-surface/8"
        >
          <Icon name={visible ? "visibility_off" : "visibility"} className="text-[20px]" />
        </button>
      </div>
      {hint && <p className="text-xs text-on-surface-variant">{hint}</p>}
    </div>
  );
}

function Spinner() {
  return <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

/** Google's "G" mark, as its sign-in branding guidelines ask for on Google sign-in buttons. */
function GoogleLogo() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
