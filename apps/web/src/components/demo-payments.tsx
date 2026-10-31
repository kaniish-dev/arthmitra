"use client";

import { simulatePayment } from "@/lib/actions";
import { useToast } from "./providers";
import { Button, Card, DemoBadge } from "./ui";

/** Demo payments that show the on-device models working (ids from SCRIPTED_PAYMENTS in seed). */
const TRIGGERS = [
  { id: "rk-traders", icon: "help", label: "New shop · RK Traders ₹1,200", tip: "Unknown shop, so it lands here. Sort it as Groceries." },
  { id: "rk-traders-again", icon: "auto_awesome", label: "Similar shop · Shree RK Traders ₹350", tip: "Smart sorting learned from your choice and sorted it by itself." },
  { id: "big-dinner", icon: "gpp_maybe", label: "Fraud test · ₹6,500 dinner", tip: "Far above your usual Food payment: fraud alert on the bell, with 1930." },
];

/** Simulates a payment arriving from the linked bank, to show smart sorting and fraud alerts. */
export function DemoPayments() {
  const toast = useToast();
  return (
    <Card className="mb-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-semibold tracking-tight">Simulate a bank payment</h2>
        <DemoBadge />
      </div>
      <p className="mb-3 text-sm text-on-surface-variant">See smart sorting learn from you, and the fraud alert fire, with a payment from your linked bank.</p>
      <div className="flex flex-wrap gap-2">
        {TRIGGERS.map((t) => (
          <Button
            key={t.id}
            variant="outlined"
            icon={t.icon}
            className="px-4 py-2"
            onClick={() => toast({ message: simulatePayment(t.id) ? t.tip : "Your bank consent is paused or revoked, so nothing new can arrive. Resume it in Bank accounts." })}
          >
            {t.label}
          </Button>
        ))}
      </div>
    </Card>
  );
}
