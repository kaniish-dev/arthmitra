import type { Metadata } from "next";
import { Ready } from "@/components/ready";
import { AddCashScreen } from "@/screens/add-cash";

export const metadata: Metadata = { title: "Add cash" };

export default function Page() {
  return (
    <Ready>
      <AddCashScreen />
    </Ready>
  );
}
