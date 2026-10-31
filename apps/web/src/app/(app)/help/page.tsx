import type { Metadata } from "next";
import { Ready } from "@/components/ready";
import { HelpScreen } from "@/screens/help";

export const metadata: Metadata = { title: "Help and safety" };

export default function HelpPage() {
  return (
    <Ready>
      <HelpScreen />
    </Ready>
  );
}
