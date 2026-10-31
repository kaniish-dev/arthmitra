import type { Metadata } from "next";
import { Ready } from "@/components/ready";
import { EmergencyScreen } from "@/screens/emergency";

export const metadata: Metadata = { title: "Emergency plan" };

export default function EmergencyPage() {
  return (
    <Ready>
      <EmergencyScreen />
    </Ready>
  );
}
