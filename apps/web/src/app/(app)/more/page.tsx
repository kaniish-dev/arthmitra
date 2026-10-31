import type { Metadata } from "next";
import { Ready } from "@/components/ready";
import { MoreScreen } from "@/screens/more";

export const metadata: Metadata = { title: "More" };

export default function Page() {
  return (
    <Ready>
      <MoreScreen />
    </Ready>
  );
}
