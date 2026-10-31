import type { Metadata } from "next";
import { Ready } from "@/components/ready";
import { CoachScreen } from "@/screens/coach";

export const metadata: Metadata = { title: "Coach" };

export default function Page() {
  return (
    <Ready>
      <CoachScreen />
    </Ready>
  );
}
