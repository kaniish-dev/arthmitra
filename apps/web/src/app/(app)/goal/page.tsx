import { redirect } from "next/navigation";

/** The single-goal page became Plan (Explore → timeline and risk → investment plan). */
export default function GoalPage() {
  redirect("/plan");
}
