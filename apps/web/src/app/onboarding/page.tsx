import { redirect } from "next/navigation";

/** Sign-up is now basic details → KYC → bank link at /setup. */
export default function OnboardingPage() {
  redirect("/setup");
}
