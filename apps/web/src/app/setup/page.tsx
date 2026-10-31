import type { Metadata } from "next";
import { SetupScreen } from "@/screens/setup";

export const metadata: Metadata = { title: "Set up your account" };

export default function SetupPage() {
  return <SetupScreen />;
}
