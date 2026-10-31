"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { markNotificationsRead } from "@/lib/actions";
import { authEnabled, logOut, useAuth } from "@/lib/auth";
import { useAppData } from "@/lib/store";
import { useAaAutoSync } from "@/lib/aa-sync";
import { DEMO_BADGE, FEATURES } from "@/lib/constants";
import { Avatar, Icon, Loading, cx } from "./ui";
import { UnusualAnswer } from "./unusual-answer";

const NAV_GROUPS: Array<{ label: string | null; items: Array<{ href: string; label: string; icon: string }> }> = [
  {
    label: null,
    items: [
      { href: "/dashboard", label: "Home", icon: "home" },
      { href: "/plan", label: "Plan", icon: "flag" },
      { href: "/portfolio", label: "Portfolio", icon: "account_balance_wallet" },
      { href: FEATURES.coach.href, label: FEATURES.coach.name, icon: FEATURES.coach.icon },
    ],
  },
  {
    label: "Add-ons",
    items: [
      { href: FEATURES.crisisCushion.href, label: FEATURES.crisisCushion.name, icon: FEATURES.crisisCushion.icon },
      { href: FEATURES.lend.href, label: FEATURES.lend.name, icon: FEATURES.lend.icon },
      { href: FEATURES.financeFirstClass.href, label: FEATURES.financeFirstClass.name, icon: FEATURES.financeFirstClass.icon },
      { href: FEATURES.befikarMode.href, label: FEATURES.befikarMode.name, icon: FEATURES.befikarMode.icon },
    ],
  },
  {
    label: "Track",
    items: [
      { href: "/history", label: "Transactions", icon: "receipt_long" },
      { href: "/insights", label: "Insights", icon: "insights" },
      { href: "/more", label: "More", icon: "apps" },
    ],
  },
];

/** Pages the sidebar links to directly (its groups, plus "Profile and settings" at the bottom). */
export const SIDEBAR_HREFS = new Set([...NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href)), "/profile", "/settings"]);

// Account pages live under Profile; one link at the bottom of the sidebar reaches all of them.
const PROFILE_PAGES = ["/profile", "/accounts", "/categories", "/import", "/settings", "/help", "/link-bank"];

// Phone bottom bar, as in the workflow: Home, Plan, Portfolio, Coach, More.
export const MOBILE_NAV = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/plan", label: "Plan", icon: "flag" },
  { href: "/portfolio", label: "Portfolio", icon: "account_balance_wallet" },
  { href: FEATURES.coach.href, label: FEATURES.coach.name, icon: FEATURES.coach.icon },
  { href: "/more", label: "More", icon: "apps" },
];

// Pages under More light up the More tab on phones.
const MORE_PAGES = ["/more", "/cushion", "/lent", "/split", "/learn", "/befikar", "/history", "/insights", "/inbox", "/add", "/bills", "/rewards", "/sort", "/emergency", ...PROFILE_PAGES];

/** Every integration in the prototype is mocked, so the badge is always shown. */
export function DemoBanner() {
  return (
    <div className="truncate border-b border-warning/15 bg-warning-container/55 px-4 py-1 text-center text-[11px] font-medium tracking-wide text-on-warning-container">
      <Icon name="science" className="mr-1 align-[-3px] text-[15px]" />
      {DEMO_BADGE} · KYC, bank data, investments and portfolio sync are mocked{authEnabled ? "" : " · data stays in this browser"}
    </div>
  );
}

function Logo() {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-[#1a73e8] to-[#0842a0] text-on-primary shadow-sm shadow-primary/30">
      <Icon name="currency_rupee" />
    </span>
  );
}

function Bell() {
  const data = useAppData();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);
  if (!data) return null;
  const uncategorised = data.transactions.filter((t) => t.status === "uncategorised").length;
  const unread = data.notifications.filter((n) => !n.read);
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label={`Notifications, ${uncategorised} uncategorised`}
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open && unread.length) markNotificationsRead();
        }}
        className="relative rounded-full p-2 hover:bg-on-surface/8"
      >
        <Icon name="notifications" filled={uncategorised > 0} />
        {uncategorised > 0 && (
          <span className="absolute top-1 right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-[11px] font-bold text-white">
            {uncategorised}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-4 top-16 z-30 surface-card rounded-2xl p-2 shadow-xl sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-80">
          <Link
            href="/inbox"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-primary/8"
          >
            <span>{uncategorised ? `${uncategorised} to sort in your inbox` : "Inbox is clear"}</span>
            <Icon name="chevron_right" />
          </Link>
          <ul className="max-h-80 overflow-y-auto">
            {data.notifications.slice(0, 8).map((n) => (
              <li key={n.id} className="border-t border-outline-variant/50 px-3 py-2 text-sm text-on-surface-variant">
                {n.message}
                {n.type === "unusual" && n.txnId && data.transactions.some((t) => t.id === n.txnId && !t.unusualCheck) && (
                  <div className="mt-2">
                    <UnusualAnswer txn={{ id: n.txnId }} />
                  </div>
                )}
              </li>
            ))}
            {data.notifications.length === 0 && <li className="px-3 py-2 text-sm text-on-surface-variant">No notifications yet.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Signed-in frame. With login on: signed-out people go to the login page and new accounts
 * to the sign-up steps. Without it (demo only): people without a profile go to onboarding.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const data = useAppData();
  const auth = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const name = data?.profile?.name.replace(" (demo)", "") ?? "";
  const uncategorised = data?.transactions.filter((t) => t.status === "uncategorised").length ?? 0;

  const redirect =
    data === null
      ? null
      : authEnabled
        ? auth.status === "signedOut"
          ? "/login"
          : auth.status === "signedIn" && (!data.registration || !data.profile)
            ? "/setup"
            : null
        : !data.registration || !data.profile
          ? "/"
          : null;

  useEffect(() => {
    if (redirect) router.replace(redirect);
  }, [redirect, router]);

  // Fetches AA data on its own while the app is open, so nobody has to press refresh.
  useAaAutoSync(data !== null && redirect === null && data.aaConsents.some((c) => c.status === "active"));

  // /split is the second tab of Lent and split.
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`) || (href === "/lent" && pathname === "/split") || (href === "/plan" && (pathname === "/explore" || pathname === "/goal"));
  const mobileActive = (href: string) => (href === "/more" ? MORE_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) : isActive(href));

  return (
    <div className="flex min-h-screen flex-col">
      <DemoBanner />
      {auth.status === "signedIn" && !auth.account.synced && (
        <div role="status" className="bg-error-container px-4 py-1.5 text-center text-xs font-medium text-on-error-container">
          <Icon name="cloud_off" className="mr-1 align-[-3px] text-[16px]" />
          Can&apos;t save to your account right now. Your changes are kept on this device.
        </div>
      )}
      <div className="flex flex-1">
        {/* Tablets get an icon rail (labels as tooltips); laptops and up get the full labelled sidebar. */}
        <nav
          aria-label="Main"
          className="sticky top-0 hidden h-screen w-20 shrink-0 flex-col gap-1 overflow-y-auto border-r border-outline-variant/60 bg-surface-container-lowest/80 p-2 backdrop-blur md:flex lg:w-64 lg:p-3"
        >
          <Link href="/dashboard" aria-label="ArthMitra home" className="mb-3 flex items-center justify-center gap-2 py-2 lg:mb-4 lg:justify-start lg:px-3">
            <Logo />
            <span className="hidden text-lg font-bold tracking-tight lg:inline">ArthMitra</span>
          </Link>
          {NAV_GROUPS.map((group) => (
            <div key={group.label ?? "main"} className={cx("flex flex-col gap-0.5", group.label && "mt-2 border-t border-outline-variant/40 pt-2 lg:mt-1 lg:border-0 lg:pt-0")}>
              {group.label && <p className="mt-2 mb-1 hidden px-4 text-[11px] font-semibold tracking-wide text-on-surface-variant uppercase lg:block">{group.label}</p>}
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cx(
                    "relative flex items-center justify-center gap-3 rounded-full py-2 text-sm font-medium lg:justify-start lg:px-4 lg:py-1.5",
                    isActive(item.href) ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-on-surface/5",
                  )}
                >
                  <Icon name={item.icon} filled={isActive(item.href)} className="text-[22px]" />
                  <span className="sr-only lg:not-sr-only lg:flex-1">{item.label}</span>
                  {item.href === "/inbox" && uncategorised > 0 && (
                    <span className="absolute top-0 right-2 rounded-full bg-error px-1.5 text-[11px] font-bold text-white lg:static lg:px-2 lg:text-xs">
                      {uncategorised}
                      <span className="sr-only"> waiting</span>
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ))}
          <Link
            href="/profile"
            title="Profile and settings"
            aria-current={PROFILE_PAGES.some(isActive) ? "page" : undefined}
            className={cx(
              "mt-auto flex items-center justify-center gap-3 rounded-full py-2 text-sm font-medium lg:justify-start lg:px-3",
              PROFILE_PAGES.some(isActive) ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-on-surface/5",
            )}
          >
            <Avatar name={name || "?"} size="sm" />
            <span className="sr-only lg:not-sr-only lg:flex-1 lg:truncate">Profile and settings</span>
          </Link>
          {auth.status !== "loading" && (
            <button
              type="button"
              title={auth.status === "signedIn" ? "Log out" : "Exit demo"}
              onClick={async () => {
                if (auth.status === "signedIn") await logOut();
                router.push("/");
              }}
              className="flex items-center justify-center gap-3 rounded-full py-2 text-sm font-medium text-on-surface-variant hover:bg-on-surface/5 lg:justify-start lg:px-4"
            >
              <Icon name="logout" className="text-[22px]" />
              <span className="sr-only lg:not-sr-only lg:flex-1 lg:truncate lg:text-left">{auth.status === "signedIn" ? "Log out" : "Exit demo"}</span>
            </button>
          )}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Phones: Home has this search bar; inner pages show their own app bar with a back arrow (PageHeader). */}
          <header
            className={cx(
              "sticky top-0 z-20 items-center gap-2 border-b border-outline-variant/40 bg-surface/90 px-4 py-2 backdrop-blur md:flex md:px-8",
              pathname === "/dashboard" ? "flex" : "hidden",
            )}
          >
            <Link href="/dashboard" aria-label="ArthMitra home" className="md:hidden">
              <Logo />
            </Link>
            <Link
              href="/history#search"
              className="flex min-w-0 flex-1 items-center gap-3 rounded-full border border-outline-variant/70 bg-surface-container-lowest px-4 py-2.5 text-sm text-on-surface-variant transition-colors hover:border-outline md:max-w-md"
            >
              <Icon name="search" className="text-[20px]" />
              <span className="truncate">Search payments</span>
            </Link>
            <div className="ml-auto flex items-center gap-1">
              <Bell />
              <Link href="/profile" aria-label="Your profile" className="rounded-full p-1 hover:bg-on-surface/8">
                <Avatar name={name || "?"} size="sm" />
              </Link>
            </div>
          </header>
          <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-3 pb-28 md:px-8 md:pt-6 md:pb-12">
            {redirect ? <Loading /> : children}
          </main>
        </div>
      </div>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-outline-variant/60 bg-surface-container-lowest/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgb(15_23_42/0.25)] backdrop-blur md:hidden"
      >
        {MOBILE_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={mobileActive(item.href) ? "page" : undefined}
            className={cx("flex flex-col items-center gap-1 py-2 text-[11px] font-medium", mobileActive(item.href) ? "text-on-surface" : "text-on-surface-variant")}
          >
            <span className={cx("rounded-full px-4 py-1", mobileActive(item.href) && "bg-primary-container text-on-primary-container")}>
              <Icon name={item.icon} filled={mobileActive(item.href)} />
            </span>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
