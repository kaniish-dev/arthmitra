import type { Metadata } from "next";
import { Ready } from "@/components/ready";
import { LinkBankScreen } from "@/screens/link-bank";

export const metadata: Metadata = { title: "Link a bank" };

export default function LinkBankPage() {
  return (
    <Ready>
      <LinkBankScreen />
    </Ready>
  );
}
