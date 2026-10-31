"use client";

import { useState } from "react";
import { formatDate, formatINR, type StatementRow } from "@arthmitra/engine";
import { importStatement, type ImportSummary } from "@/lib/actions";
import { readStatementFile, STATEMENT_ACCEPT } from "@/lib/statement-file";
import { useAppData } from "@/lib/store";
import { Button, Card, CardTitle, Chip, Icon, LinkButton, PageHeader, TextInput } from "@/components/ui";

/** Statement upload (F20): CSV, Excel or PDF with duplicate detection, the fallback to bank linking. */
export function ImportScreen() {
  const [file, setFile] = useState<File | null>(null);
  const [reading, setReading] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [rows, setRows] = useState<StatementRow[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [error, setError] = useState("");
  const [bank, setBank] = useState("");
  const [last4, setLast4] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const data = useAppData();
  // Accounts a statement can go to; AA-linked ones get their payments from the AA.
  const uploadable = data?.accounts.filter((a) => a.status === "active" && (a.source === "manual" || a.source === "csv")) ?? [];

  const read = async (next: File, pdfPassword?: string) => {
    setSummary(null);
    setError("");
    setRows(null);
    setFile(next);
    if (pdfPassword === undefined) {
      setNeedsPassword(false);
      setPassword("");
    }
    setReading(true);
    const result = await readStatementFile(next, pdfPassword);
    setReading(false);
    if (!result.ok) {
      setError(result.error);
      if (result.needsPassword) setNeedsPassword(true);
      return;
    }
    setNeedsPassword(false);
    if (result.rows.length === 0) {
      setError("No transactions found in this statement.");
      return;
    }
    setRows(result.rows);
    setSkipped(result.skipped);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Upload a bank statement"
        subtitle="For a bank not on the Account Aggregator network yet."
        action={
          <LinkButton href="/link-bank" variant="outlined" icon="link">
            Link with AA instead
          </LinkButton>
        }
      />
      <Card className="mb-6">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-outline-variant p-8 text-center hover:bg-primary/5">
          <Icon name="upload_file" className="text-4xl text-primary" />
          <span className="font-medium">{reading ? "Reading the statement…" : file?.name || "Choose a statement"}</span>
          <span className="text-xs text-on-surface-variant">
            CSV, Excel (.xls, .xlsx) or PDF from your net banking · read on this device · duplicates are skipped
          </span>
          <input type="file" accept={STATEMENT_ACCEPT} className="sr-only" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
        </label>
        {needsPassword && file && (
          <form
            className="mt-4 flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (password) void read(file, password);
            }}
          >
            <div className="min-w-0 flex-1 basis-56">
              <TextInput
                label="PDF password"
                type="password"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                hint="Your bank's email says how it's made, often from your date of birth or customer ID. It isn't stored."
              />
            </div>
            <Button type="submit" icon="lock_open" disabled={!password || reading}>
              Open
            </Button>
          </form>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-error">
            {error}
          </p>
        )}
      </Card>

      {rows && !summary && (
        <Card>
          <CardTitle icon="table">
            {rows.length} transactions found{skipped ? ` · ${skipped} rows skipped` : ""}
          </CardTitle>
          <div className="mb-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-on-surface-variant">
                  <th className="py-1 font-medium">Date</th>
                  <th className="py-1 font-medium">Description</th>
                  <th className="py-1 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50">
                {rows.slice(0, 6).map((r, i) => (
                  <tr key={i}>
                    <td className="py-1.5 whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="py-1.5">{r.description}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatINR(r.amountPaise, { signed: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {uploadable.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-sm text-on-surface-variant">Statement of:</span>
              {uploadable.map((a) => (
                <Chip
                  key={a.id}
                  selected={bank === a.bankName && last4 === a.last4}
                  onClick={() => {
                    setBank(a.bankName);
                    setLast4(a.last4);
                  }}
                >
                  {a.bankName} ••{a.last4}
                </Chip>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextInput label="Bank name" value={bank} onChange={(e) => setBank(e.target.value)} placeholder="e.g. My salary bank" />
            <TextInput
              label="Last 4 digits of the account"
              inputMode="numeric"
              value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
              hint="Only these 4 digits are stored."
            />
          </div>
          <Button
            icon="download_done"
            className="mt-4"
            disabled={!bank.trim() || last4.length !== 4 || rows.length === 0}
            onClick={() => setSummary(importStatement({ bankName: bank.trim(), last4, rows }))}
          >
            Import {rows.length} transactions
          </Button>
        </Card>
      )}

      {summary && (
        <Card className="bg-primary-container/40">
          <CardTitle icon="task_alt">Import finished</CardTitle>
          <p className="text-sm">
            {summary.added} added · {summary.duplicates} duplicates skipped · {summary.toInbox} waiting in your inbox.
          </p>
          <div className="mt-4 flex gap-3">
            <LinkButton href="/dashboard" icon="home">
              Dashboard
            </LinkButton>
            {summary.toInbox > 0 && (
              <LinkButton href="/inbox" variant="tonal" icon="inbox">
                Sort {summary.toInbox}
              </LinkButton>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
