import type { Metadata } from "next";
import { Ready } from "@/components/ready";
import { ProfileScreen } from "@/screens/profile";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <Ready>
      <ProfileScreen />
    </Ready>
  );
}
