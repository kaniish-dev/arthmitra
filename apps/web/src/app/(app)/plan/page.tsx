import type { Metadata } from "next";
import { Ready } from "@/components/ready";
import { PlansScreen } from "@/screens/plan";

export const metadata: Metadata = { title: "Plan" };

export default function Page() {
  return (
    <Ready>
      <PlansScreen />
    </Ready>
  );
}
