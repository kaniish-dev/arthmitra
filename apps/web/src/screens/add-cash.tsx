"use client";

import { useEffect, useState } from "react";
import { formatINR, spendCategories, todayIso } from "@arthmitra/engine";
import { addTransaction, newId, setSettings } from "@/lib/actions";
import { useAppData } from "@/lib/store";
import { useToast } from "@/components/providers";
import { AmountInput, Badge, Button, Card, CardTitle, Chip, Icon, PageHeader, Select, TextInput, Toggle } from "@/components/ui";

type Mode = "cash" | "bill";

/** Cash spends (F10): typed in, or read from a bill photo when AI is connected. */
export function AddCashScreen() {
  const data = useAppData()!;
  const toast = useToast();
  const today = todayIso();
  const [mode, setMode] = useState<Mode>("cash");
  const [amount, setAmount] = useState<number | null>(null);
  const [what, setWhat] = useState("");
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo);
  }, [photo]);

  const reset = () => {
    setAmount(null);
    setWhat("");
    setDate(today);
    setCategory("");
    setPhoto(null);
  };

  const save = () => {
    if (!amount || !what.trim()) return;
    const t = addTransaction({
      accountId: null,
      date,
      amountPaise: -amount,
      merchantRaw: what.trim(),
      source: mode === "bill" ? "bill" : "cash",
      reference: newId("cash"),
      note: mode === "bill" ? "From a bill photo" : "Cash",
      category: category || null,
      billId: mode === "bill" ? newId("bill") : null,
    });
    if (t) {
      toast({
        message:
          t.status === "categorised"
            ? `${formatINR(amount)} cash saved under ${data.categories.find((c) => c.id === t.category)?.name}.`
            : `${formatINR(amount)} cash saved to your inbox to sort later.`,
      });
      reset();
    }
  };

  const categoryOptions = [
    { value: "", label: "Not sure — put it in my inbox" },
    ...spendCategories(data.categories).map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Add a cash spend" subtitle="Cash doesn't show in bank records, so add it here." />
      <div className="mb-4 flex gap-2" role="tablist" aria-label="How to add">
        <Chip role="tab" aria-selected={mode === "cash"} selected={mode === "cash"} icon="edit" onClick={() => setMode("cash")}>
          Type it in
        </Chip>
        <Chip role="tab" aria-selected={mode === "bill"} selected={mode === "bill"} icon="photo_camera" onClick={() => setMode("bill")}>
          Scan a bill
        </Chip>
      </div>

      <Card>
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          {mode === "bill" && (
            <div className="flex flex-col gap-3">
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-outline-variant p-6 text-center hover:bg-primary/5">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="Bill to read" className="max-h-56 rounded-xl object-contain" />
                ) : (
                  <>
                    <Icon name="photo_camera" className="text-4xl text-primary" />
                    <span className="text-sm font-medium">Take a photo or choose an image of the bill</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setPhoto(URL.createObjectURL(file));
                  }}
                />
              </label>
              <p className="flex items-start gap-2 rounded-2xl bg-secondary-container/60 p-3 text-sm text-on-secondary-container">
                <Icon name="auto_awesome" />
                <span>
                  Gemini reads the merchant, date, total and line items once Vertex AI is connected. In demo mode, fill the fields below — the
                  photo is not stored.
                </span>
              </p>
            </div>
          )}

          <AmountInput label={mode === "bill" ? "Bill total" : "How much?"} valuePaise={amount} onChange={setAmount} autoFocus={mode === "cash"} />
          <TextInput
            label={mode === "bill" ? "Shop name on the bill" : "What was it for?"}
            placeholder={mode === "bill" ? "e.g. Sharma General Store" : "e.g. Vegetables, auto fare"}
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            maxLength={80}
          />
          <TextInput label="Date" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
          <Select label="Category" value={category} onChange={setCategory} options={categoryOptions} />

          <Button type="submit" icon="save" disabled={!amount || !what.trim()}>
            Save cash spend
          </Button>
        </form>
      </Card>

      <Card className="mt-4">
        <CardTitle icon="notifications_active" action={<Badge tone="info">Optional</Badge>}>
          Daily reminder
        </CardTitle>
        <Toggle
          label="Ask “Any cash spends today?” every evening"
          description="Arrives as a bell notification and web push once Firebase Cloud Messaging is set up."
          checked={data.settings.cashReminder}
          onChange={(v) => setSettings({ cashReminder: v })}
        />
      </Card>
    </div>
  );
}
