import type { Metadata } from "next";
import { Suspense } from "react";
import { Ready } from "@/components/ready";
import { Loading } from "@/components/ui";
import { PlanViewScreen } from "@/screens/plan";

export const metadata: Metadata = { title: "Investment plan" };

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Ready>
        <PlanViewScreen />
      </Ready>
    </Suspense>
  );
}
