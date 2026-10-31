"use client";

import { categoryName, formatINR, formatMonth, monthKey, summariseMonth, todayIso, tryToPaise } from "@arthmitra/engine";
import type { Transaction } from "@arthmitra/schema";
import { useEffect, useRef, useState } from "react";
import { downloadFile, toCsv } from "@/lib/files";
import { merchantLabel } from "@/lib/format";
import { useAppData } from "@/lib/store";
import { TransactionRow, TransactionSheet } from "@/components/transactions";
import { Card, Chip, EmptyState, Icon, IconButton, PageHeader } from "@/components/ui";

type Filter = "all" | "paid" | "received" | "unsorted";

const FILTERS: Array<{ id: Filter; label: string; icon: string }> = [
  { id: "all", label: "All", icon: "list" },
  { id: "paid", label: "Paid", icon: "call_made" },
  { id: "received", label: "Received", icon: "call_received" },
  { id: "unsorted", label: "Needs a category", icon: "help" },
];

/** Every payment, newest first, grouped by month, with search and filters. */
export function HistoryScreen() {
  const data = useAppData()!;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const search = useRef<HTMLInputElement>(null);

  // The search pill in the header links here as /history#search.
  useEffect(() => {
    if (window.location.hash === "#search") search.current?.focus();
  }, []);

  const q = query.trim().toLowerCase();
  // A number like "1,200" or "₹450" finds that exact amount; anything else searches the text.
  const amount = /^₹?\s*[\d,]+(\.\d{1,2})?$/.test(q) ? tryToPaise(q) : null;
  const unsorted = data.transactions.filter((t) => t.status === "uncategorised").length;
  const shown = data.transactions.filter((t) => {
    if (filter === "paid" && t.amountPaise >= 0) return false;
    if (filter === "received" && t.amountPaise <= 0) return false;
    if (filter === "unsorted" && t.status !== "uncategorised") return false;
    if (!q) return true;
    if (amount !== null) return Math.abs(t.amountPaise) === Math.abs(amount);
    const text = [merchantLabel(t.merchantKey), t.merchantRaw, t.note ?? "", t.category ? categoryName(data.categories, t.category) : ""];
    return text.join(" ").toLowerCase().includes(q);
  });

  const months: Array<{ key: string; txns: Transaction[] }> = [];
  for (const t of shown) {
    const key = monthKey(t.date);
    const last = months.at(-1);
    if (last?.key === key) last.txns.push(t);
    else months.push({ key, txns: [t] });
  }

  return (
    <>
      <PageHeader
        title="Transaction history"
        subtitle={`${data.transactions.length} payments from your banks, statements and cash`}
        tools={
          <IconButton
            icon="download"
            label="Download these payments as CSV"
            onClick={() => {
              const rows = shown.map((t) => [
                t.date,
                merchantLabel(t.merchantKey),
                t.status === "uncategorised" ? "Uncategorised" : categoryName(data.categories, t.category),
                t.amountPaise / 100,
                t.source,
                t.note ?? "",
              ]);
              downloadFile(`arthmitra-payments-${todayIso()}.csv`, toCsv([["Date", "Shop", "Category", "Amount (₹)", "Source", "Note"], ...rows]), "text/csv");
            }}
          />
        }
      />

      <div className="mb-5">
        <label className="relative block">
          <span className="sr-only">Search payments</span>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-on-surface-variant" />
          <input
            ref={search}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Shop, category, note or amount"
            className="w-full rounded-full bg-surface-container-high py-3 pr-4 pl-12 text-base text-on-surface placeholder:text-on-surface-variant focus:outline-2 focus:outline-primary"
          />
        </label>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {FILTERS.map((f) => (
            <Chip key={f.id} icon={f.icon} selected={filter === f.id} onClick={() => setFilter(f.id)} className="shrink-0">
              {f.label}
              {f.id === "unsorted" && unsorted > 0 ? ` (${unsorted})` : ""}
            </Chip>
          ))}
        </div>
      </div>

      {months.length === 0 ? (
        <Card>
          <EmptyState icon="search_off" title="No payments match">
            Try another word, or switch the filter back to All.
          </EmptyState>
        </Card>
      ) : (
        months.map((m) => (
          <section key={m.key} aria-label={formatMonth(m.key)} className="mb-6">
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h2 className="text-sm font-semibold">{formatMonth(m.key)}</h2>
              <p className="text-xs text-on-surface-variant">Spent {formatINR(summariseMonth(data.transactions, m.key).spendingPaise)}</p>
            </div>
            <Card className="p-2 sm:p-3">
              <ul>
                {m.txns.map((t) => (
                  <TransactionRow key={t.id} data={data} t={t} onOpen={(x) => setOpenId(x.id)} />
                ))}
              </ul>
            </Card>
          </section>
        ))
      )}

      <TransactionSheet data={data} txnId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
