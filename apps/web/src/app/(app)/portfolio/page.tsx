import type { Metadata } from "next";
import { Ready } from "@/components/ready";
import { PortfolioScreen } from "@/screens/portfolio";

export const metadata: Metadata = { title: "Portfolio" };

export default function Page() {
  return (
    <Ready>
      <PortfolioScreen />
    </Ready>
  );
}
