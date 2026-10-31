import type { Metadata } from "next";
import { AuthScreen } from "@/screens/login";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return <AuthScreen initialMode="signup" />;
}
