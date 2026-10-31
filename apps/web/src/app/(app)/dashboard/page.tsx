import type { Metadata } from "next";
import { Ready } from "@/components/ready";
import { DashboardScreen } from "@/screens/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function Page() {
  return (
    <Ready>
      <DashboardScreen />
    </Ready>
  );
}
