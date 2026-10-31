import type { Metadata } from "next";
import { Ready } from "@/components/ready";
import { InsightsScreen } from "@/screens/insights";

export const metadata: Metadata = { title: "Insights" };

export default function InsightsPage() {
  return (
    <Ready>
      <InsightsScreen />
    </Ready>
  );
}
