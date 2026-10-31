import type { Metadata } from "next";
import { Ready } from "@/components/ready";
import { BillsScreen } from "@/screens/bills";

export const metadata: Metadata = { title: "Bills and subscriptions" };

export default function BillsPage() {
  return (
    <Ready>
      <BillsScreen />
    </Ready>
  );
}
