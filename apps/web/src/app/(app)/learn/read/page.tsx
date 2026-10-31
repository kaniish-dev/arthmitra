"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Ready } from "@/components/ready";
import { Loading } from "@/components/ui";
import { ArticleScreen } from "@/screens/learn";

function Article() {
  return <ArticleScreen id={useSearchParams().get("id")} />;
}

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Ready>
        <Article />
      </Ready>
    </Suspense>
  );
}
