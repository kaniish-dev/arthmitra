# ArthMitra

An AI money coach for Gen Z and under-30 users in India. ArthMitra reads your past spending, sets a realistic monthly saving, builds a plan for a Big Day or long-term wealth matched to your timeline and risk appetite, sends you to a third-party investment app to invest, then tracks your portfolio. **It never holds money or places trades — it plans, redirects and tracks.** Team Quantum Core · GDG Udaipur Aravalli Build Challenge.

## Run it

```bash
npm install
cp apps/web/.env.example apps/web/.env.local   # then fill it in (below)
npm run dev        # http://localhost:3000
npm test           # engine + seed tests (Vitest)
npm run typecheck
npm run build
```

Without any keys the app runs as a **local demo**: data stays in the browser, the login OTP is shown on screen, and the Coach and dashboard tips use templates. Every screen shows a **Demo mode** badge because KYC, bank data, investing and portfolio sync are mocked.

### Environment

| Variable | What for |
|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | Firebase web config (Auth + Firestore). Leave empty for the local demo |
| `NEXT_PUBLIC_DEMO_EMAIL`, `NEXT_PUBLIC_DEMO_PASSWORD` | One-tap demo logins with Firebase on. The 24-year-old uses this email, the 16-year-old the same address with `+minor` (`demo+minor@…`); both are created on first use and reset to seeded data at every login |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini (free tier from Google AI Studio) for the Coach, the "Realistic monthly saving" explanation and the plan research summary. Server-side only |
| `NEXT_PUBLIC_PARTNER_NAME`, `NEXT_PUBLIC_PARTNER_URL` | The third-party investment app the "Invest" buttons open. No broker is named in the prototype |

### Firebase project

1. Create a project, add a web app, copy its config into `.env.local`.
2. **Authentication → Sign-in method:** enable **Phone**, **Google** and **Email/Password** (email is the fallback). Under Phone, add **test phone numbers** (for example `+91 98000 00024` → `123456`) so development never sends a real SMS.
3. **Firestore:** create the database and publish `firestore.rules` (`npm run deploy:rules`). Users can read and write only their own `users/{uid}`.
4. Phone OTP sends real SMS only on the paid Blaze plan; on the free Spark plan use the test phone numbers above, Google or email.

### Deploy (free, from this machine)

The app is hosted on **Vercel Hobby** (free, no card). Firebase App Hosting (`apphosting.yaml`) needs the Blaze plan, so it is kept only for later.

1. `npm run check` — tests, typecheck, lint and a production build must all pass.
2. `npm run deploy` — the first run logs in to Vercel and links the project. Answer: set up and deploy → yes; link to existing project → no; code directory → `./apps/web`; keep the detected Next.js settings. `.vercelignore` keeps `node_modules`, builds and `.env*.local` out of the upload.
3. In the Vercel project → Settings → Environment Variables, paste the contents of `apps/web/.env.local` (every variable in the table above), then run `npm run deploy` again so the build picks them up.
4. Firebase console → Authentication → Settings → **Authorized domains**: add the `*.vercel.app` domain, or Google and phone sign-in fail on the live site.
5. `npm run deploy:rules` once (logs in to Firebase the first time).

Later deploys are just `npm run check && npm run deploy`. Pushing to GitHub is not needed to deploy.

### Seed data

There is no separate seed step: `seed/src/personas.ts` builds the two demo personas (9 and 6 months of mock transactions, KYC, goals, plans, holdings, loans) whenever a one-tap demo login is pressed. Finance First Class articles are seeded from `apps/web/src/config/articles.json`.

## What is mocked and how it goes live

| Integration | In the prototype | Going live |
|---|---|---|
| KYC (`lib/services/kyc.ts`) | PAN `AAAAA9999A` and 12-digit Aadhaar format checks, a short wait, then "Verified". Only `XXXXX1234X` and the last 4 Aadhaar digits are stored | A licensed provider (UIDAI e-KYC via a KUA/AUA partner, PAN verification via NSDL/UTIITSL) called from a server |
| Bank details (`lib/services/bank.ts`) | IFSC regex `^[A-Z]{4}0[A-Z0-9]{6}$`, bank from the IFSC prefix, branch from a sample list | RBI's IFSC master or a lookup API |
| Account Aggregator (`lib/services/aa.ts`) | Real consent screen (data, duration, purpose, approve/deny); approving returns 6–12 months of sample transactions | A licensed AA through a technology service provider; ArthMitra or a regulated partner acts as the FIU. Data arrives in the ReBIT format `readDepositData` already reads |
| Statement upload | Real parsing of CSV, Excel and text PDFs in the browser; a PDF whose layout can't be read returns labelled sample rows | Same, plus more bank PDF layouts |
| Portfolio tracking (`lib/services/portfolio.ts`) | `PortfolioTrackingAPI` returns holdings made from each goal's plan; "Sync now" and last-synced time | A portfolio-tracking provider (mutual-fund RTA statements, depository holdings) with the user's or guardian's consent |
| Partner app (`config/partner.ts`) | Generic "Invest on a third-party app" button opening the configured URL | Set the partner's name and URL |
| Befikar Mode (`config/befikar.ts`) | Coming-soon screen with a labelled sample | Live Freedom Date from the portfolio and expenses |

## Demo script (2 minutes)

Each demo login offers **Walk through every step** (an empty account that starts at sign-up, with an **Autofill demo values** button on every form — basic details, KYC, bank, a sample CSV statement, plan, portfolio connect, Lend, Crisis Cushion — and a checklist on Home that ticks each step off) or **Skip to ready account** (the seeded persona). The script below uses the ready account:

1. **Login screen** → *Aarav, 24 · salaried* (one tap). Home opens on **month on month**: tap months to see income, total spend, money left, **fixed vs variable** and spend by category.
2. **Realistic monthly saving** card: the rule-based number (80% of average money left) with Gemini's 2–3 line explanation and 2 tips. Tap **Plan something**.
3. **Explore** → **Save for a Big Day** → *Dream Vacation*, ₹1,50,000 in 18 months → **Timeline** (derived: short term) and **Risk** (pick High: note the equity cap and the Crisis Cushion nudge) → **plan**: monthly SIP, allocation donut, projection, on-track check → **Save plan**.
4. On the plan, open **Research this category** under a line to see the 3 funds that score best among their peers, with dated AMFI figures and Gemini's read (research, not a recommendation). Then tap **Invest on a third-party app** (opens the partner URL; nothing is bought in ArthMitra).
5. **Portfolio** tab → **Sync now**: per-goal invested, current value, % reached, on track or behind, monthly top-up; the Wealth view shows passive income and where you stand today.
6. **Coach** → *"I want to buy a refrigerator worth 30k in the next 3 months"* → **Make it a savings goal**. Try *"Can I afford a 40k trip in March?"*.
7. **More** → Crisis Cushion, Lend (overdue badge, **Mark repaid**, copy reminder), Finance First Class, Befikar Mode.
8. Log out → *Ananya, 16 · with guardian*: Profile shows guardian KYC; Portfolio tracks the guardian's account. Or sign up fresh with a mobile number to walk through **basic details → KYC → bank link (AA consent or statement upload)**.

## Screens

Bottom navigation (phones): **Home · Plan · Portfolio · Coach · More**. Wider screens get a sidebar with the same items plus the add-ons.

| Step | Screen |
|---|---|
| 1. Login and basic details | `/` (mobile OTP, Google, email fallback, two demo logins) → `/setup` step 1: name, date of birth, email, mobile. Age decides the KYC path |
| 2. KYC | `/setup` step 2: own PAN + Aadhaar at 18+, guardian's name, relationship, PAN + Aadhaar below 18 (account flagged `isMinor` and linked to the guardian). Compliance note on screen |
| 3. Link bank | `/setup` step 3: holder name, account number + confirm, IFSC with bank/branch lookup, then AA consent or statement upload. Ends sign-up |
| 4. Dashboard | `/dashboard`: month on month, fixed vs variable, spend by category, realistic monthly saving + Gemini tips, plans, Befikar teaser, add-ons |
| 5–7. Explore, timeline and risk, plan | `/explore` → `/plan/view?id=…`; all plans at `/plan` |
| 8. Portfolio | `/portfolio`: connect an account (generic app list, owner self or guardian, mock consent), Sync now, per goal, wealth view, holdings |
| 9. Befikar Mode | `/befikar` (coming soon, labelled sample) |
| Add-ons | `/coach`, `/cushion` (Crisis Cushion), `/lent` (Lend), `/learn` (Finance First Class) |

Feature names live in one place, `apps/web/src/lib/constants.ts`, with the compliance notes and the disclaimer. Plan settings (timeline bands, mix per risk, equity cap per timeline, assumed returns shown to users) live in `apps/web/src/config/plan.ts`; the maths is in `packages/engine/src/allocation.ts` and `savings.ts`, unit-tested for the savings calculation, timeline mapping and allocation mapping. The extra tracking tools from the first build (transactions, inbox, insights, bills, split, emergency plan, rewards) are under **More**.

## Layout

| Path | What it is |
|---|---|
| `apps/web` | Next.js 16 (App Router) app — screens in `src/screens`, data layer in `src/lib`, mocked integrations in `src/lib/services`, editable tables in `src/config` |
| `packages/schema` | Zod schemas and types for every stored document (registration with masked KYC, bank link, goals with plans, investment accounts, holdings, loans…) |
| `packages/engine` | Finance engine in integer paise: savings insights, allocation and projection, coach templates and the Gemini prompt, categorisation, AA reader, CSV/PDF statements, money lent |
| `seed` | Mock bank history, the two demo personas, and the mock portfolio-tracking data |

**Data model.** Each user's tree mirrors `users/{uid}` with `registration` (name, dob, mobile, email, isMinor, kycStatus, panMasked, aadhaarLast4, guardian, bank), `transactions`, `goals` (type `bigDay | wealth | crisisCushion | custom`, timeline, risk, plan), `investmentAccounts`, `holdings` and `loans`. In this prototype the whole tree is saved as one Firestore document; splitting it into subcollections is a future add-on.

## Bank statements: Account Aggregator

Bank data comes through RBI's Account Aggregator network. ArthMitra asks for a periodic consent with purpose code 102 (spending patterns and budgets), for `SUMMARY` and `TRANSACTIONS` of `DEPOSIT` accounts only — never `PROFILE` — for 12 months (`consentRequest` in `packages/engine/src/aa.ts`). Every AA delivers the same ReBIT format, so one reader (`readDepositData`) handles every bank; the demo AA sends its payments through it too. Statement upload is the second and only other way in, for banks not on the network: CSV, Excel (.xls/.xlsx) or text PDF (password-protected PDFs ask for the password), read in the browser so the file never leaves the device (`readStatementTable` in `csv.ts`, `pdfTable` in `pdf-table.ts`). At sign-up the user enters the holder name, account number and IFSC (only the last 4 digits are kept); account number and IFSC alone give no history, so it then comes through AA consent or a statement. Cash spends are entered with Add cash.

Going live needs an integration with an RBI-licensed AA, usually through a technology service provider, and the receiving side (the FIU) must be an entity regulated by RBI, SEBI, IRDAI or PFRDA — ArthMitra itself or a regulated partner.

## AI and machine learning

Four models, one per key moment — what each does, why, where it runs and a real example: [docs/ml.md](docs/ml.md).

| Model | Technique | Runs | Shows up as |
|---|---|---|---|
| Smart sorting | TF-IDF + k-nearest neighbours | Browser | Payments sort themselves; learns from each Inbox correction |
| Unusual-payment check | Median + MAD anomaly detection, learns from "This was me" | Browser | "Was this you?" on the bell and Insights, with the 1930 helpline |
| Goal success odds + this year's outlook | Monte Carlo, 2,000 market paths | Browser | "92% chance" ring and the next-12-months range on every plan |
| Gemini money coach | Google Gemini, grounded and checked | Server routes `/api/coach`, `/api/insights`, `/api/research/explain` | Coach chat; Home saving explanation and tips; plan research summary |

## Money lent, the money coach and emergencies

- **Lent money** (`packages/engine/src/loans.ts`): record money given to someone, by hand or from a payment. A payment that went out as a loan, and the payback when it comes in, count as neither spending nor income (system category "Lent money"). A credit whose narration carries the person's first name, for no more than they owe, is marked as paid back automatically. ArthMitra never asks anyone for money; it prepares a reminder the user sends.
- **Where money should go** (`planForMoney` in `plan.ts`): bills due in 10 days the balance doesn't cover → the emergency cushion, up to 3 months of essentials → 80% of the rest to the goal → the rest is the user's.
- **Next steps** (`nextSteps`): one list, most urgent first, shown as "For you today" on Home and at the top of the coach.
- **Monthly flow** (`flow.ts`): four habits worth 25 points each — every payment sorted, every budget kept, saved for the goal, no lent money overdue. Perfect months in a row raise the level (Steady 1, Strong 3, Champion 6). No money value.
- **Emergency plan** (`emergencyPlan`): months the free balance covers, goal saving to pause, extras to stop, money to call back, investments free today versus locked; emergency mode puts it first everywhere. Helplines: 112, 1930 (cyber fraud), 14416.

The coach is not fine-tuned; it is taught by:

- `COACH_SYSTEM_INSTRUCTION` and `COACH_EXAMPLES` in `packages/engine/src/coach-prompt.ts` — the rules and worked answers sent to Gemini.
- The engine works out every figure (the payback plan, the emergency numbers, the flow); the coach only explains them and offers buttons from `COACH_ACTIONS`.
- `checkCoachAnswer`: rejects an answer with blocked wording, a rupee figure not in the snapshot, or an unknown button.
- `COACH_EVALS`: test questions with expected behaviour. The template coach passes all of them in `npm test`; Gemini answers are scored on the same set.

Crisis, medical and product questions never reach the model: templates answer them, with Tele-MANAS (14416) for crisis.

## Not in this build yet

- Live KYC, Account Aggregator and portfolio-tracking providers (all behind service interfaces, ready to swap).
- Befikar Mode as a live Freedom Date calculation.
- Firestore subcollections and server-side AA fetches; push notifications.

*Educational guidance, not investment advice. Returns are not guaranteed. ArthMitra never holds money or places trades.*
