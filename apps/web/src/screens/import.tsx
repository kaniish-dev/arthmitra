"use client";

import { useState } from "react";
import { detectColumns, formatDate, formatINR, parseCsv, statementRows, type StatementRow } from "@arthmitra/engine";
import { importStatement, type ImportSummary } from "@/lib/actions";
import { Button, Card, CardTitle, Icon, LinkButton, PageHeader, TextInput } from "@/components/ui";

/** Statement import (F20): CSV with duplicate detection, the fallback to bank linking. */
export function ImportScreen() {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<StatementRow[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [error, setError] = useState("");
  const [bank, setBank] = useState("");
  const [last4, setLast4] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const read = async (file: File) => {
    setSummary(null);
    setError("");
    setRows(null);
    setFileName(file.name);
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please choose a .csv file. Most banks offer CSV under “Download statement”. XLSX support comes with the server import.");
      return;
    }
    const table = parseCsv(await file.text());
    const headerIndex = table.findIndex((r) => detectColumns(r) !== null);
    if (headerIndex === -1) {
      setError("Couldn't find Date, Description and Amount (or Debit/Credit) columns in this file.");
      return;
    }
    const result = statementRows(table.slice(headerIndex + 1), detectColumns(table[headerIndex]!)!);
    setRows(result.rows);
    setSkipped(result.skipped);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Upload a CSV statement"
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
          <span className="font-medium">{fileName || "Choose a CSV statement"}</span>
          <span className="text-xs text-on-surface-variant">Columns like Date, Narration, Withdrawal, Deposit · duplicates are skipped</span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
        </label>
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
