import { useSyncExternalStore } from "react";
import type { AppData } from "@arthmitra/schema";
import { emptyData } from "@arthmitra/seed";

/**
 * One user's data tree, shaped like Firestore's users/{uid}. Signed out it is the demo,
 * kept in localStorage; signed in it is that user's tree, cached in localStorage and
 * saved to Firestore through the account's backend. Components subscribe the way they
 * would to Firestore listeners.
 */
const DEMO_KEY = "arthmitra:v1";

/** Where a signed-in user's data is saved besides this browser. */
export interface Backend {
  save: (data: AppData) => void;
  remove: () => void;
}

let storageKey = DEMO_KEY;
let backend: Backend | null = null;
// False until the auth check decides whose data to show, so screens don't flash the demo.
let accountReady = false;
let current: AppData | null = null;
const listeners = new Set<() => void>();
let watchingOtherTabs = false;

/** Categories added in later versions that existing users should get too. */
const ADDED_CATEGORIES = new Set(["subscriptions"]);

/**
 * Fills in fields and categories added in later versions (such as "Lent money" and
 * "Subscriptions"). A registration from the older sign-up (no date of birth or KYC status)
 * is dropped, so the user goes through basic details → KYC → bank link again; their
 * transactions, goals and loans are kept.
 */
function normalize(stored: Partial<AppData>): AppData {
  const base = emptyData();
  const categories = stored.categories
    ? [...stored.categories, ...base.categories.filter((c) => (c.system || ADDED_CATEGORIES.has(c.id)) && !stored.categories!.some((s) => s.id === c.id))]
    : base.categories;
  const reg = stored.registration as Partial<NonNullable<AppData["registration"]>> | null | undefined;
  const registration = reg && reg.dob && reg.kycStatus ? stored.registration! : null;
  return { ...base, ...stored, registration, categories, partners: [], settings: { ...base.settings, ...stored.settings } };
}

function read(): AppData {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw) return normalize(JSON.parse(raw) as Partial<AppData>);
  } catch {
    // Storage blocked or corrupt: start empty rather than crash.
  }
  return emptyData();
}

function cache(data: AppData) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(data));
  } catch {
    // Quota or privacy mode: keep the in-memory copy for this session.
  }
}

export function getData(): AppData {
  if (current === null) current = read();
  return current;
}

function emit() {
  for (const listener of listeners) listener();
}

export function setData(next: AppData) {
  current = next;
  cache(next);
  backend?.save(next);
  emit();
}

export function update(fn: (data: AppData) => AppData) {
  setData(fn(getData()));
}

export function clearData() {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Nothing stored or storage blocked.
  }
  backend?.remove();
  current = emptyData();
  emit();
}

/**
 * Points the store at a signed-in user (their saved tree, or null for a new account) or,
 * with no uid, back at the demo.
 */
export function openAccount(uid: string | null, saved: Partial<AppData> | null, next: Backend | null) {
  storageKey = uid ? `${DEMO_KEY}:${uid}` : DEMO_KEY;
  backend = next;
  current = saved ? normalize(saved) : null;
  if (current) cache(current);
  accountReady = true;
  emit();
}

/** Hides data while the auth check runs (sign-in or sign-out in progress). */
export function holdAccount() {
  accountReady = false;
  emit();
}

/** Forgets a signed-out user's cached copy on this device. */
export function forgetCache(uid: string) {
  try {
    window.localStorage.removeItem(`${DEMO_KEY}:${uid}`);
  } catch {
    // Storage blocked.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!watchingOtherTabs) {
    watchingOtherTabs = true;
    window.addEventListener("storage", (e) => {
      if (e.key === storageKey) {
        current = null;
        emit();
      }
    });
  }
  return () => {
    listeners.delete(listener);
  };
}

const snapshot = () => (accountReady ? getData() : null);

/** The user's data, or null during server render, hydration and the auth check. */
export function useAppData(): AppData | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
