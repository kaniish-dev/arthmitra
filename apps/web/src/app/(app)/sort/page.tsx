import type { Metadata } from "next";
import { Ready } from "@/components/ready";
import { SortGameScreen } from "@/screens/sort-game";

export const metadata: Metadata = { title: "Sort game" };

export default function Page() {
  return (
    <Ready>
      <SortGameScreen />
    </Ready>
  );
}
