"use client";

import type { ReactNode } from "react";
import { useAppData } from "@/lib/store";
import { Loading } from "./ui";

/**
 * Renders a screen once the user's data has loaded in the browser. Lives inside each
 * page (not the layout) so every page segment still renders during prerender.
 */
export function Ready({ children }: { children: ReactNode }) {
  const data = useAppData();
  if (!data || !data.profile) return <Loading />;
  return children;
}
