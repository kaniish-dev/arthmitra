import type { Metadata } from "next";
import { Ready } from "@/components/ready";
import { CategoriesScreen } from "@/screens/categories";

export const metadata: Metadata = { title: "Categories" };

export default function Page() {
  return (
    <Ready>
      <CategoriesScreen />
    </Ready>
  );
}
