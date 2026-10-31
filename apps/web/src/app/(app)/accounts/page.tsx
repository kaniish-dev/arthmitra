import type { Metadata } from "next";
import { Ready } from "@/components/ready";
import { AccountsScreen } from "@/screens/accounts";

export const metadata: Metadata = { title: "Bank accounts" };

export default function AccountsPage() {
  return (
    <Ready>
      <AccountsScreen />
    </Ready>
  );
}
