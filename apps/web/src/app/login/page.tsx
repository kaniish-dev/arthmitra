import type { Metadata } from "next";
import { AuthScreen } from "@/screens/login";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return <AuthScreen initialMode="login" />;
}
