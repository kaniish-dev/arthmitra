import { LandingActions } from "@/screens/landing-actions";
import { Icon } from "@/components/ui";
import { DemoBanner } from "@/components/app-shell";

const STEPS = [
  { icon: "edit_note", title: "Tell us your numbers", text: "Income, fixed costs like rent and EMIs, a rough monthly spend and one goal. Under two minutes." },
  { icon: "account_balance", title: "Link your bank with consent", text: "Through RBI's Account Aggregator network. You see the purpose, data range and expiry before you agree." },
  { icon: "sports_esports", title: "Every payment, sorted", text: "Clear payments sort themselves. Unclear ones and cash wait in your inbox for a 30-second sorting game." },
  { icon: "flag", title: "A number and a date", text: "How much to save each month, when you reach the goal, and which kinds of instrument fit the timeline." },
];

const PRIVACY = [
  { icon: "lock", text: "We never ask for bank passwords, UPI PINs or OTPs, and store only the last 4 digits of an account." },
  { icon: "verified_user", text: "Bank data comes only through the Account Aggregator network, with consent you can withdraw." },
  { icon: "delete", text: "Export everything as a file or delete it all, any time, from Settings." },
  { icon: "school", text: "We explain types of instruments for your timeline. We never name a fund or stock or promise returns." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <DemoBanner />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-8">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-on-primary">
            <Icon name="currency_rupee" />
          </span>
          <span className="text-lg font-bold tracking-tight">ArthMitra</span>
        </div>
        <span className="hidden text-sm text-on-surface-variant sm:block">GDG Aravalli Build Challenge · Team Quantum Core</span>
      </header>

      <main className="mx-auto max-w-6xl px-4 md:px-8">
        <section className="grid grid-cols-1 items-center gap-10 py-10 md:grid-cols-[1.2fr_1fr] md:py-16">
          <div>
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary-container px-3 py-1 text-sm font-medium text-on-primary-container">
              <Icon name="savings" className="text-[18px]" /> For salaried Indians who pay by UPI
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-on-surface sm:text-5xl">
              Har kharch ka hisaab,
              <br />
              <span className="text-primary">har sapne ka plan.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-on-surface-variant">
              ArthMitra shows every payment as it happens, sorts it for you, and turns what is left into a dated plan for one goal — a car, a
              wedding, an emergency fund.
            </p>
            <LandingActions />
          </div>
          <div aria-hidden className="relative mx-auto w-full max-w-sm">
            <div className="rounded-[2rem] bg-surface-container-lowest p-5 shadow-xl ring-1 ring-outline-variant/60">
              <p className="text-xs font-medium text-on-surface-variant uppercase">Car down payment</p>
              <p className="mt-1 text-3xl font-semibold">₹19,500/month</p>
              <p className="text-sm text-on-surface-variant">needed for 12 months · you can save ₹17,000</p>
              <div className="mt-4 h-2.5 rounded-full bg-surface-container-highest">
                <div className="h-full w-[12%] rounded-full bg-primary" />
              </div>
              <div className="mt-5 space-y-3">
                {[
                  ["restaurant", "Swiggy", "Food", "-₹450"],
                  ["help", "RK Traders", "Sort", "-₹1,200"],
                  ["payments", "Salary", "Income", "+₹50,000"],
                ].map(([icon, name, cat, amt]) => (
                  <div key={name} className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
                      <Icon name={icon!} className="text-[20px]" />
                    </span>
                    <span className="flex-1 text-sm font-medium">{name}</span>
                    <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs">{cat}</span>
                    <span className="w-20 text-right text-sm font-semibold tabular-nums">{amt}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -right-3 -bottom-4 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-lg">
              Move the date 2 months → on track
            </div>
          </div>
        </section>

        <section aria-labelledby="how" className="py-10">
          <h2 id="how" className="mb-6 text-2xl font-semibold">How it works</h2>
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-3xl bg-surface-container-low p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary">{i + 1}</span>
                  <Icon name={s.icon} className="text-primary" />
                </div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-on-surface-variant">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="privacy" className="py-10">
          <h2 id="privacy" className="mb-6 text-2xl font-semibold">Private by design</h2>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PRIVACY.map((p) => (
              <li key={p.icon} className="flex gap-3 rounded-3xl border border-outline-variant p-5">
                <Icon name={p.icon} className="text-2xl text-primary" />
                <p className="text-sm">{p.text}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="mt-10 border-t border-outline-variant/60 py-8 text-center text-xs text-on-surface-variant">
        <p>Educational guidance, not financial advice. ArthMitra never moves money.</p>
        <p className="mt-1">Prototype built on Firebase, Gemini and Google Cloud for the GDG Aravalli Build Challenge.</p>
      </footer>
    </div>
  );
}
