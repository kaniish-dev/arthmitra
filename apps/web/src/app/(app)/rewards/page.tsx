import type { Metadata } from "next";
import { Ready } from "@/components/ready";
import { RewardsScreen } from "@/screens/rewards";

export const metadata: Metadata = { title: "Rewards" };

export default function RewardsPage() {
  return (
    <Ready>
      <RewardsScreen />
    </Ready>
  );
}
