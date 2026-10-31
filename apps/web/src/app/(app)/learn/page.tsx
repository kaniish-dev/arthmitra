import type { Metadata } from "next";
import { Ready } from "@/components/ready";
import { LearnScreen } from "@/screens/learn";

export const metadata: Metadata = { title: "Finance First Class" };

export default function Page() {
  return (
    <Ready>
      <LearnScreen />
    </Ready>
  );
}
