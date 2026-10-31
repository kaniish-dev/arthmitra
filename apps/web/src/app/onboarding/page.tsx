import type { Metadata } from "next";
import { OnboardingScreen } from "@/screens/onboarding";

export const metadata: Metadata = { title: "Set up" };

export default function OnboardingPage() {
  return <OnboardingScreen />;
}
