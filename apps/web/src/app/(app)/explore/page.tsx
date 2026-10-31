import type { Metadata } from "next";
import { Suspense } from "react";
import { Ready } from "@/components/ready";
import { Loading } from "@/components/ui";
import { ExploreScreen } from "@/screens/explore";

export const metadata: Metadata = { title: "Plan something" };

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Ready>
        <ExploreScreen />
      </Ready>
    </Suspense>
  );
}
