import type { Metadata } from "next";
import { Ready } from "@/components/ready";
import { ImportScreen } from "@/screens/import";

export const metadata: Metadata = { title: "Upload a statement" };

export default function Page() {
  return (
    <Ready>
      <ImportScreen />
    </Ready>
  );
}
