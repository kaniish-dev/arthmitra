import type { Metadata } from "next";
import { Ready } from "@/components/ready";
import { GoalScreen } from "@/screens/goal";

export const metadata: Metadata = { title: "Goal" };

export default function Page() {
  return (
    <Ready>
      <GoalScreen />
    </Ready>
  );
}
