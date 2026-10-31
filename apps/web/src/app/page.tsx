import { AuthScreen } from "@/screens/login";

/** The first screen is login / sign-up; signed-in people are sent on from there. */
export default function LandingPage() {
  return <AuthScreen initialMode="login" />;
}
