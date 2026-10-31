import type { Metadata } from "next";
import { Ready } from "@/components/ready";
import { HistoryScreen } from "@/screens/history";

export const metadata: Metadata = { title: "Transaction history" };

export default function HistoryPage() {
  return (
    <Ready>
      <HistoryScreen />
    </Ready>
  );
}
