"use client";

import { useRouter } from "next/navigation";
import { startDemo, startFresh } from "@/lib/actions";
import { useAppData } from "@/lib/store";
import { Button, Icon, LinkButton } from "@/components/ui";

export function LandingActions() {
  const router = useRouter();
  const data = useAppData();
  const signedIn = Boolean(data?.profile);
  return (
    <div className="mt-8 flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {signedIn ? (
          <LinkButton href="/dashboard" icon="dashboard">
            Continue as {data!.profile!.name}
          </LinkButton>
        ) : (
          <Button
            icon="play_arrow"
            onClick={() => {
              startDemo();
              router.push("/link-bank");
            }}
          >
            Try the demo as Rohit
          </Button>
        )}
        <Button
          variant="outlined"
          icon="person_add"
          onClick={() => {
            startFresh();
            router.push("/onboarding");
          }}
        >
          Start with my own numbers
        </Button>
      </div>
      <button
        type="button"
        disabled
        className="inline-flex w-fit items-center gap-2 rounded-full border border-outline-variant px-4 py-2 text-sm text-on-surface-variant"
        title="Turns on once Firebase Authentication is configured"
      >
        <Icon name="login" className="text-[18px]" />
        Sign in with Google — connects when Firebase is set up
      </button>
    </div>
  );
}
