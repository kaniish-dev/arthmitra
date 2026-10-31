import type { Metadata } from "next";
import { Ready } from "@/components/ready";
import { CushionScreen } from "@/screens/cushion";

export const metadata: Metadata = { title: "Crisis Cushion" };

export default function Page() {
  return (
    <Ready>
      <CushionScreen />
    </Ready>
  );
}
