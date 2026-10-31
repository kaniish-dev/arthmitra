import type { Metadata } from "next";
import { Ready } from "@/components/ready";
import { SettingsScreen } from "@/screens/settings";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return (
    <Ready>
      <SettingsScreen />
    </Ready>
  );
}
