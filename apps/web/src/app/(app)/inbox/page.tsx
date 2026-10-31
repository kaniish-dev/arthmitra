import type { Metadata } from "next";
import { Ready } from "@/components/ready";
import { InboxScreen } from "@/screens/inbox";

export const metadata: Metadata = { title: "Inbox" };

export default function Page() {
  return (
    <Ready>
      <InboxScreen />
    </Ready>
  );
}
