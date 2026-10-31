import { useSyncExternalStore } from "react";
import { getApps, initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
  updateProfile,
  type Auth,
  type ConfirmationResult,
} from "firebase/auth";
import { deleteDoc, doc, getDoc, getFirestore, serverTimestamp, setDoc, type Firestore } from "firebase/firestore";
import type { AppData } from "@arthmitra/schema";
import { emptyData, personaData, type PersonaId } from "@arthmitra/seed";
import { todayIso } from "@arthmitra/engine";
import { ALLOCATION_CONFIG } from "@/config/plan";
import { forgetCache, holdAccount, openAccount, type Backend } from "./store";

/**
 * Firebase Authentication (mobile OTP, Google, email as a fallback) and the Firestore copy of each
 * user's data at users/{uid}. Without the NEXT_PUBLIC_FIREBASE_* keys the app stays
 * demo-only and login is hidden.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const authEnabled = Boolean(config.apiKey && config.projectId);

/** Shared account for hackathon presentations; it starts from the beginning on every login. */
const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_EMAIL?.toLowerCase();
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD;
export const demoEnabled = authEnabled && Boolean(DEMO_EMAIL && DEMO_PASSWORD);
/** Demo personas share the demo password; the minor gets "+minor" in the email (a+minor@b.com). */
const personaEmail = (id: PersonaId) => (id === "adult" ? DEMO_EMAIL! : DEMO_EMAIL!.replace("@", "+minor@"));
export const isDemoAccount = (account: { email: string | null } | null | undefined) =>
  demoEnabled && (account?.email?.toLowerCase() === DEMO_EMAIL || account?.email?.toLowerCase() === personaEmail("minor"));
/** The persona whose seeded data replaces the account on its next login. */
let resetOnOpen: { id: PersonaId; ready: boolean } | null = null;

let services: { auth: Auth; db: Firestore } | null = null;

// Created on first use in the browser, never during server render.
function firebase() {
  if (!services) {
    const app = getApps()[0] ?? initializeApp(config);
    services = { auth: getAuth(app), db: getFirestore(app) };
  }
  return services;
}

export interface Account {
  uid: string;
  email: string | null;
  name: string | null;
  /** +91… when the user signed in with mobile OTP. */
  phone: string | null;
  /** False when the saved copy couldn't be loaded: changes stay on this device. */
  synced: boolean;
}

export type AuthState = { status: "loading" } | { status: "signedOut" } | { status: "signedIn"; account: Account };

const LOADING: AuthState = { status: "loading" };
let state: AuthState = LOADING;
const listeners = new Set<() => void>();
let started = false;
let flushPending: () => Promise<void> = async () => {};

function setState(next: AuthState) {
  state = next;
  for (const listener of listeners) listener();
}

/** Updates the "saved to your account" flag that Profile and the app bar show. */
function markSynced(uid: string, synced: boolean) {
  if (state.status === "signedIn" && state.account.uid === uid && state.account.synced !== synced) {
    setState({ ...state, account: { ...state.account, synced } });
  }
}

/** Saves to users/{uid} at most once every 800 ms; the whole tree is one document. */
function cloudBackend(db: Firestore, uid: string): Backend {
  const ref = doc(db, "users", uid);
  let latest: AppData | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = async () => {
    clearTimeout(timer);
    if (!latest) return;
    const data = latest;
    latest = null;
    try {
      await setDoc(ref, { data: JSON.stringify(data), updatedAt: serverTimestamp() });
      markSynced(uid, true);
    } catch (e) {
      // Usually the Firestore rules aren't published (permission-denied); the browser copy is kept.
      console.error("ArthMitra: could not save to Firestore", e);
      markSynced(uid, false);
    }
  };
  flushPending = flush;
  return {
    save: (data) => {
      latest = data;
      clearTimeout(timer);
      timer = setTimeout(flush, 800);
    },
    remove: () => {
      latest = null;
      clearTimeout(timer);
      deleteDoc(ref).catch((e) => console.error("ArthMitra: could not delete from Firestore", e));
    },
  };
}

/** Starts listening for sign-in and sign-out; called once from the root Providers. */
export function startAuth() {
  if (started) return;
  started = true;
  if (!authEnabled) {
    openAccount(null, null, null);
    setState({ status: "signedOut" });
    return;
  }
  const { auth, db } = firebase();
  let previousUid: string | null = null;
  let generation = 0;
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushPending();
  });
  onAuthStateChanged(auth, async (user) => {
    const mine = ++generation;
    holdAccount();
    if (!user) {
      if (previousUid) forgetCache(previousUid);
      previousUid = null;
      flushPending = async () => {};
      openAccount(null, null, null);
      setState({ status: "signedOut" });
      return;
    }
    previousUid = user.uid;
    let saved: Partial<AppData> | null = null;
    let synced = true;
    // Walk-through: an empty account that starts at sign-up. Ready: the persona's seeded data.
    const reset =
      resetOnOpen && isDemoAccount(user)
        ? resetOnOpen.ready
          ? personaData(resetOnOpen.id, todayIso(), new Date().toISOString(), ALLOCATION_CONFIG.returnsPct)
          : emptyData()
        : null;
    resetOnOpen = null;
    if (reset) {
      saved = reset;
    } else {
      try {
        const raw = (await getDoc(doc(db, "users", user.uid))).data()?.data;
        if (typeof raw === "string") saved = JSON.parse(raw) as Partial<AppData>;
      } catch (e) {
        // Offline or rules not published: work from this device's copy and don't overwrite the cloud one.
        console.error("ArthMitra: could not load from Firestore", e);
        synced = false;
      }
    }
    if (mine !== generation) return;
    const backend = synced ? cloudBackend(db, user.uid) : null;
    openAccount(user.uid, saved, backend);
    if (reset) backend?.save(reset);
    setState({ status: "signedIn", account: { uid: user.uid, email: user.email, name: user.displayName, phone: user.phoneNumber, synced } });
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, () => state, () => LOADING);
}

export async function signUp(name: string, email: string, password: string) {
  const { user } = await createUserWithEmailAndPassword(firebase().auth, email, password);
  if (!name) return;
  await updateProfile(user, { displayName: name });
  // The auth listener may already have run without the name.
  if (state.status === "signedIn" && state.account.uid === user.uid) setState({ ...state, account: { ...state.account, name } });
}

export async function logIn(email: string, password: string) {
  await signInWithEmailAndPassword(firebase().auth, email, password);
}

/**
 * One-tap demo login as a persona (account created the first time). `ready` loads the persona's
 * seeded data; otherwise the account is wiped and starts at sign-up, for a step-by-step walk-through.
 */
export async function logInAsPersona(id: PersonaId, ready = false) {
  const { auth } = firebase();
  const email = personaEmail(id);
  resetOnOpen = { id, ready };
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, DEMO_PASSWORD!);
    await updateProfile(user, { displayName: id === "adult" ? "Aarav Mehta" : "Ananya Rao" });
  } catch (e) {
    if ((e as { code?: string }).code !== "auth/email-already-in-use") {
      resetOnOpen = null;
      throw e;
    }
    await signInWithEmailAndPassword(auth, email, DEMO_PASSWORD!);
  }
}

let verifier: RecaptchaVerifier | null = null;

/**
 * Sends a login OTP by SMS (Firebase phone auth, behind an invisible reCAPTCHA). In development,
 * add test numbers in Firebase console → Authentication → Sign-in method → Phone, so no SMS is sent.
 */
export async function sendPhoneOtp(mobile10: string, containerId: string): Promise<ConfirmationResult> {
  const { auth } = firebase();
  verifier?.clear();
  verifier = new RecaptchaVerifier(auth, containerId, { size: "invisible" });
  try {
    return await signInWithPhoneNumber(auth, `+91${mobile10}`, verifier);
  } catch (e) {
    verifier.clear();
    verifier = null;
    throw e;
  }
}

export async function confirmPhoneOtp(confirmation: ConfirmationResult, code: string) {
  await confirmation.confirm(code);
}

export async function logInWithGoogle() {
  await signInWithPopup(firebase().auth, new GoogleAuthProvider());
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(firebase().auth, email);
}

export async function logOut() {
  await flushPending();
  await signOut(firebase().auth);
}

const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Email or password is wrong.",
  "auth/wrong-password": "Email or password is wrong.",
  "auth/user-not-found": "No account with this email. Sign up instead.",
  "auth/email-already-in-use": "An account with this email already exists. Log in instead.",
  "auth/weak-password": "Use at least 6 characters for the password.",
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/missing-password": "Enter your password.",
  "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups for this site and try again.",
  "auth/network-request-failed": "No internet connection. Check it and try again.",
  "auth/too-many-requests": "Too many tries. Wait a few minutes and try again.",
  "auth/operation-not-allowed": "This sign-in method is turned off in the Firebase console (Authentication → Sign-in method).",
  "auth/invalid-phone-number": "That mobile number doesn't look right.",
  "auth/invalid-verification-code": "That OTP is wrong. Check the SMS and try again.",
  "auth/code-expired": "That OTP has expired. Send a new one.",
  "auth/captcha-check-failed": "The robot check failed. Reload the page and try again.",
  "auth/quota-exceeded": "Too many OTPs sent today. Try Google or email, or a test number.",
  "auth/billing-not-enabled": "SMS OTP needs billing on this Firebase project. Use a test phone number (see README) or Google.",
  "auth/unauthorized-domain": "This web address can't sign in yet. Add it in the Firebase console under Authentication → Settings → Authorized domains.",
};

/**
 * Phone OTP failures that look like "turned off" even with the Phone provider enabled: Firebase
 * also needs SMS to India allowed (SMS region policy) and, for real SMS, the Blaze plan.
 */
const PHONE_MESSAGES: Record<string, string> = {
  "auth/operation-not-allowed":
    "SMS OTP isn't available for this Firebase project yet. Phone is enabled, but Firebase also needs India (+91) allowed under Authentication → Settings → SMS region policy, and real SMS needs the Blaze plan. Until then, add this number under Sign-in method → Phone → Phone numbers for testing, or use Google or a demo login.",
  "auth/billing-not-enabled":
    "Real SMS OTP needs the Blaze plan on this Firebase project. Add this number under Sign-in method → Phone → Phone numbers for testing, or use Google or a demo login.",
  "auth/unauthorized-domain":
    "This web address can't send OTPs yet. Add it in the Firebase console under Authentication → Settings → Authorized domains.",
};

/** A message for the person, or null when they simply closed the Google window. */
export function authErrorMessage(error: unknown, context: "phone" | "other" = "other"): string | null {
  const code = (error as { code?: string })?.code ?? "";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return null;
  if (context === "phone" && PHONE_MESSAGES[code]) return PHONE_MESSAGES[code]!;
  return MESSAGES[code] ?? "Something went wrong. Try again.";
}
