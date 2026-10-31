import type { Metadata } from "next";
import { Ready } from "@/components/ready";
import { ImportScreen } from "@/screens/import";

export const metadata: Metadata = { title: "CSV statement" };

export default function Page() {
  return (
    <Ready>
      <ImportScreen />
    </Ready>
  );
}
