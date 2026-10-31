import { useSyncExternalStore } from "react";
import type { AppData } from "@arthmitra/schema";
import { emptyData } from "@arthmitra/seed";

/**
 * Demo-mode store: one user's data tree in localStorage, shaped like Firestore's
 * users/{uid}. Components subscribe the way they will to Firestore listeners.
 */
const STORAGE_KEY = "arthmitra:v1";

let current: AppData | null = null;
const listeners = new Set<() => void>();
let watchingOtherTabs = false;

function read(): AppData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Partial<AppData>;
      const base = emptyData();
      // System categories added in later versions (such as "Lent money") join older saved data.
      const categories = stored.categories
        ? [...stored.categories, ...base.categories.filter((c) => c.system && !stored.categories!.some((s) => s.id === c.id))]
        : base.categories;
      return { ...base, ...stored, categories, settings: { ...base.settings, ...stored.settings } };
    }
  } catch {
    // Storage blocked or corrupt: start empty rather than crash.
  }
  return emptyData();
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
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Quota or privacy mode: keep the in-memory copy for this session.
  }
  emit();
}

export function update(fn: (data: AppData) => AppData) {
  setData(fn(getData()));
}

export function clearData() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored or storage blocked.
  }
  current = emptyData();
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!watchingOtherTabs) {
    watchingOtherTabs = true;
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY) {
        current = null;
        emit();
      }
    });
  }
  return () => {
    listeners.delete(listener);
  };
}

/** The user's data, or null during server render and hydration. */
export function useAppData(): AppData | null {
  return useSyncExternalStore(subscribe, getData, () => null);
}
