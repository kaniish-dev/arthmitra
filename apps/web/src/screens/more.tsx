"use client";

import { MOBILE_NAV, SIDEBAR_HREFS } from "@/components/app-shell";
import { ADD_ONS_LABEL, FEATURES } from "@/lib/constants";
import { useAppData } from "@/lib/store";
import { ListRow, ListSection, PageHeader } from "@/components/ui";

interface Row {
  href: string;
  icon: string;
  label: string;
  sub?: string;
}

const BOTTOM_BAR = new Set(MOBILE_NAV.map((i) => i.href));

/**
 * "More": only the pages the navigation doesn't already show. The lists come from the sidebar
 * and bottom-bar config, so nothing is ever listed twice:
 * - in the bottom bar (Home, Plan, Portfolio, Coach) → never listed here;
 * - in the sidebar only (add-ons, Transactions, Insights, Profile, Settings) → listed on phones,
 *   where there is no sidebar, and hidden from md up, where the sidebar is on screen;
 * - in neither → always listed.
 */
export function MoreScreen() {
  const data = useAppData()!;
  const inbox = data.transactions.filter((t) => t.status === "uncategorised").length;
  const sections: Array<{ title: string; rows: Row[] }> = [
    {
      title: ADD_ONS_LABEL,
      rows: [FEATURES.coach, FEATURES.crisisCushion, FEATURES.lend, FEATURES.financeFirstClass, FEATURES.befikarMode].map((f) => ({
        href: f.href,
        icon: f.icon,
        label: f.name,
        sub: f === FEATURES.befikarMode ? "Coming soon · your Freedom Date" : f.tagline,
      })),
    },
    {
      title: "Money tools",
      rows: [
        { href: "/history", icon: "receipt_long", label: "Transactions", sub: "Search, filter, download CSV" },
        { href: "/insights", icon: "insights", label: "Insights and budgets", sub: "Month in review, budgets, unusual payments" },
        { href: "/inbox", icon: "inbox", label: "Inbox", sub: inbox ? `${inbox} to sort` : "All sorted" },
        { href: "/bills", icon: "event_repeat", label: "Bills and subscriptions", sub: "Repeating payments and due dates" },
        { href: "/add", icon: "payments", label: "Add cash spend", sub: "For money spent in cash" },
        { href: "/split", icon: "call_split", label: "Split a bill", sub: "Who owes what" },
        { href: "/emergency", icon: "emergency_home", label: "Emergency plan", sub: "What to do if something goes wrong" },
        { href: "/rewards", icon: "military_tech", label: "Rewards", sub: "Points, badges and monthly flow" },
        { href: "/sort", icon: "sports_esports", label: "Sort game", sub: "Sort unclear payments in 30 seconds" },
      ],
    },
    {
      title: "Account",
      rows: [
        { href: "/profile", icon: "person", label: "Profile and KYC" },
        { href: "/accounts", icon: "account_balance", label: "Bank accounts and AA consents" },
        { href: "/import", icon: "upload_file", label: "Upload a statement" },
        { href: "/categories", icon: "category", label: "Categories" },
        { href: "/settings", icon: "settings", label: "Settings" },
        { href: "/help", icon: "help", label: "Help and safety" },
      ],
    },
  ];

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <PageHeader title="More" />
      <div className="flex flex-col gap-6">
        {sections.map((s) => {
          const rows = s.rows.filter((r) => !BOTTOM_BAR.has(r.href));
          if (rows.length === 0) return null;
          // A section whose every row is in the sidebar only shows on phones.
          const phoneOnly = rows.every((r) => SIDEBAR_HREFS.has(r.href));
          return (
            <div key={s.title} className={phoneOnly ? "md:hidden" : undefined}>
              <ListSection title={s.title}>
                {rows.map((r) => (
                  <div key={r.href} className={SIDEBAR_HREFS.has(r.href) ? "md:hidden" : undefined}>
                    <ListRow href={r.href} icon={r.icon} label={r.label} sub={r.sub} />
                  </div>
                ))}
              </ListSection>
            </div>
          );
        })}
      </div>
    </div>
  );
}
