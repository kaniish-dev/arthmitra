import type { Metadata } from "next";
import { Ready } from "@/components/ready";
import { LentScreen } from "@/screens/lent";

export const metadata: Metadata = { title: "Lent and split" };

export default function SplitPage() {
  return (
    <Ready>
      <LentScreen initialTab="split" />
    </Ready>
  );
}
