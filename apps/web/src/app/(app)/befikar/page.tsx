import type { Metadata } from "next";
import { Ready } from "@/components/ready";
import { BefikarScreen } from "@/screens/befikar";

export const metadata: Metadata = { title: "Befikar Mode" };

export default function Page() {
  return (
    <Ready>
      <BefikarScreen />
    </Ready>
  );
}
