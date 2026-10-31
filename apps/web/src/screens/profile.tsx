"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate, formatMonth, outstandingPaise } from "@arthmitra/engine";
import { deleteEverything } from "@/lib/actions";
import { authEnabled, isDemoAccount, logOut, useAuth } from "@/lib/auth";
import { showAadhaar } from "@/lib/id-check";
import { useAppData } from "@/lib/store";
import { Avatar, Badge, Button, Icon, LinkButton, ListRow, ListSection, PageHeader } from "@/components/ui";

/** Profile hub, reached from the avatar: who you are, then everything grouped by what it is for. */
export function ProfileScreen() {
  const data = useAppData()!;
  const auth = useAuth();
  const router = useRouter();
  const account = auth.status === "signedIn" ? auth.account : null;
  const reg = data.registration;
  const p = data.profile!;
  const name = p.name.replace(" (demo)", "");
  const isDemo = p.name.endsWith("(demo)");
  const linked = data.accounts.filter((a) => a.status === "active").length;
  const goal = data.goals.find((g) => g.status === "active") ?? data.goals[0];
  const owed = data.splits.flatMap((s) => s.people).filter((x) => !x.settled).length + data.loans.filter((l) => outstandingPaise(l) > 0).length;

  const stats = [
    { icon: "stars", value: p.points, label: "Points" },
    { icon: "local_fire_department", value: p.streak, label: "Day streak" },
    { icon: "military_tech", value: p.badges.length, label: "Badges" },
  ];

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <PageHeader title="Profile" />
      <div className="flex flex-col gap-6">
        <section className="flex flex-col items-center gap-2 rounded-3xl surface-card px-5 py-8 text-center">
          <Avatar name={name} size="xl" />
          <h2 className="mt-2 text-2xl font-semibold">{name}</h2>
          <p className="text-sm text-on-surface-variant">
            {isDemo ? "Demo account" : "Your account"} · with ArthMitra since {formatMonth(p.createdAt.slice(0, 7))}
          </p>
          <div className="mt-1 flex flex-wrap justify-center gap-2">
            {p.is18Plus ? (
              <Badge tone="good" icon="verified">
                18+ · own KYC
              </Badge>
            ) : (
              <Badge tone="warn" icon="family_restroom">
                Under 18 · linked to guardian
              </Badge>
            )}
            {account ? (
              account.synced ? (
                <Badge tone="info" icon="cloud_done">
                  Saved to your account
                </Badge>
              ) : (
                <Badge tone="warn" icon="cloud_off">
                  Saved on this device only
                </Badge>
              )
            ) : (
              <Badge tone="info" icon="lock">
                Stored only in this browser
              </Badge>
            )}
          </div>
          <ul className="mt-4 grid w-full max-w-sm grid-cols-3 gap-2">
            {stats.map((s) => (
              <li key={s.label}>
                <Link href="/rewards" className="flex flex-col items-center gap-1 rounded-2xl bg-surface-container px-2 py-3 hover:bg-surface-container-high">
                  <Icon name={s.icon} filled className="text-on-warning-container" />
                  <span className="text-lg font-semibold tabular-nums">{s.value}</span>
                  <span className="text-xs text-on-surface-variant">{s.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {(account || reg) && (
          <ListSection title="Account and KYC">
            <dl className="divide-y divide-outline-variant/50 px-2 text-sm">
              <DetailRow icon="mail" label="Email" value={reg?.email ?? account?.email ?? "—"} />
              {reg && <DetailRow icon="cake" label="Date of birth" value={formatDate(reg.dob)} />}
              {reg && <DetailRow icon="call" label="Mobile" value={`${reg.mobile.slice(0, 3)} ${reg.mobile.slice(3, 8)} ${reg.mobile.slice(8)}`} />}
              {reg?.guardian && (
                <DetailRow
                  icon="family_restroom"
                  label="Guardian KYC"
                  value={`${reg.guardian.name} (${RELATION[reg.guardian.relation]}) · PAN ${reg.guardian.panMasked} · Aadhaar ${showAadhaar(reg.guardian.aadhaarLast4)}`}
                  status={reg.kycStatus === "verified" ? "Verified" : undefined}
                />
              )}
              {reg?.panMasked && reg.aadhaarLast4 && (
                <DetailRow
                  icon="verified_user"
                  label="KYC"
                  value={`PAN ${reg.panMasked} · Aadhaar ${showAadhaar(reg.aadhaarLast4)}`}
                  status={reg.kycStatus === "verified" ? "Verified" : undefined}
                />
              )}
              {reg?.bank && (
                <DetailRow
                  icon="account_balance"
                  label="Bank"
                  value={`${reg.bank.bankName} ····${reg.bank.accountLast4} · ${reg.bank.ifsc} · via ${reg.bank.historySource === "aa" ? "Account Aggregator" : "statement upload"}`}
                />
              )}
            </dl>
            <div className="flex flex-wrap gap-2 px-2 pt-2 pb-1">
              {account && isDemoAccount(account) && (
                <Button
                  variant="tonal"
                  icon="restart_alt"
                  onClick={() => {
                    deleteEverything();
                    router.push("/setup");
                  }}
                >
                  Restart the demo
                </Button>
              )}
              <Button
                variant="outlined"
                icon="logout"
                                onClick={async () => {
                  await logOut();
                  router.push("/login");
                }}
              >
                Log out
              </Button>
            </div>
          </ListSection>
        )}

        {auth.status === "signedOut" && (
          <ListSection title="Account">
            <div className="flex flex-wrap items-center gap-3 px-2 py-2">
              <Icon name="science" className="text-on-surface-variant" />
              <span className="min-w-0 flex-1 text-sm">You&apos;re in the demo. Sign up to save your own numbers.</span>
              {authEnabled && (
                <LinkButton href="/signup" icon="person_add" className="px-4 py-2">
                  Sign up
                </LinkButton>
              )}
              <LinkButton href="/" variant="outlined" icon="logout" className="px-4 py-2">
                Exit demo
              </LinkButton>
            </div>
          </ListSection>
        )}

        <ListSection title="Your money">
          <ListRow href="/accounts" icon="account_balance" label="Bank accounts" sub={`${linked} linked · consent and balances`} />
          <ListRow href="/plan" icon="flag" label="Your plans" sub={goal ? goal.name : "Plan something"} />
          <ListRow href="/portfolio" icon="account_balance_wallet" label="Portfolio" sub="Investments and when they are free" />
          <ListRow href="/lent" icon="handshake" label="Lent and split" sub={owed ? `${owed} ${owed === 1 ? "person owes" : "people owe"} you` : "Nobody owes you right now"} />
        </ListSection>

        <ListSection title="Settings">
          <ListRow href="/explore" icon="rocket_launch" label="Plan something" sub="Save for a Big Day or start the Wealth Generator" />
          <ListRow href="/categories" icon="category" label="Categories and rules" sub="Limits, merges and merchant rules" />
          <ListRow href="/settings" icon="tune" label="Settings" sub="Consent, AI, alerts and your data" />
        </ListSection>

        <ListSection title="Help">
          <ListRow href="/help" icon="help" label="Help and safety" sub="How ArthMitra works and common questions" />
        </ListSection>

        <p className="pb-2 text-center text-xs text-on-surface-variant">ArthMitra prototype · Educational guidance, not financial advice.</p>
      </div>
    </div>
  );
}

const RELATION = { mother: "mother", father: "father", legal_guardian: "legal guardian" } as const;

function DetailRow({ icon, label, value, status }: { icon: string; label: string; value: string; status?: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon name={icon} className="mt-0.5 text-[20px] text-on-surface-variant" />
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-on-surface-variant">{label}</dt>
        <dd className="truncate">{value}</dd>
      </div>
      {status && <Badge tone={status === "Verified" ? "good" : "info"}>{status}</Badge>}
    </div>
  );
}
