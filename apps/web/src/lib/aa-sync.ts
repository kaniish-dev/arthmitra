"use client";

import type { AaConsent, AppData } from "@arthmitra/schema";
import { useEffect, useState } from "react";
import { fetchAaNow } from "@/lib/actions";
import { getData } from "@/lib/store";

const UNIT_MS: Record<AaConsent["detail"]["frequency"]["unit"], number> = {
  HOUR: 3_600_000,
  DAY: 86_400_000,
  MONTH: 30 * 86_400_000,
  YEAR: 365 * 86_400_000,
};
/** How often the due check runs; the consent's frequency decides whether a fetch happens. */
const CHECK_MS = 60_000;

/** Shortest gap between fetches the consent allows (frequency 1 per HOUR → one hour). */
export function fetchGapMs(consent: AaConsent): number {
  const { unit, value } = consent.detail.frequency;
  return UNIT_MS[unit] / value;
}

/** When the consent may next be fetched, or null when it is not active. */
export function nextFetchAt(consent: AaConsent): number | null {
  if (consent.status !== "active") return null;
  if (!consent.lastFetchedAt) return Date.now();
  return new Date(consent.lastFetchedAt).getTime() + fetchGapMs(consent);
}

/** The newest fetch across active and paused consents, as an ISO time. */
export function lastAaUpdate(data: AppData): string | null {
  return data.aaConsents
    .filter((c) => c.status === "active" || c.status === "paused")
    .reduce<string | null>((latest, c) => (c.lastFetchedAt && (!latest || c.lastFetchedAt > latest) ? c.lastFetchedAt : latest), null);
}

function fetchDue() {
  const at = Date.now();
  for (const c of getData().aaConsents) {
    const next = nextFetchAt(c);
    if (next !== null && next <= at) fetchAaNow(c.id);
  }
}

/**
 * Keeps AA data fresh without a button: fetches each active consent as soon as its
 * frequency allows, and again when the app comes back on screen or back online.
 * In production the AA's "data ready" webhook writes to Firestore and the listener
 * updates the screen the same way.
 */
export function useAaAutoSync(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    fetchDue();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") fetchDue();
    }, CHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchDue();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", fetchDue);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", fetchDue);
    };
  }, [enabled]);
}

/** Current time that ticks every 30 seconds, so "2 min ago" stays true. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/** "just now", "5 min ago", "2 hr ago", or a date and time for anything older than a day. */
export function agoLabel(iso: string, now: number): string {
  const mins = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)} hr ago`;
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

/** "in 48 min", "in 3 hr", or "soon" once due. */
export function inLabel(at: number, now: number): string {
  const mins = Math.ceil((at - now) / 60_000);
  if (mins <= 1) return "soon";
  if (mins < 60) return `in ${mins} min`;
  return `in ${Math.round(mins / 60)} hr`;
}
