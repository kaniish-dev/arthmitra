# ArthMitra

*Har kharch ka hisaab, har sapne ka plan.* A web app that shows every payment as it happens, sorts it into a category, and turns the surplus into a dated plan for one goal. Team Quantum Core · GDG Aravalli Build Challenge.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # engine + seed tests (Vitest)
npm run typecheck
npm run build
```

Open the app and choose **Try the demo as Rohit**. Everything runs in **demo mode**: fictional data in your browser's local storage, a simulated Account Aggregator, and rule-based sorting and coach answers. Nothing leaves the browser.

## Layout

| Path | What it is |
|---|---|
| `apps/web` | Next.js 16 (App Router) app — screens in `src/screens`, data layer in `src/lib` |
| `packages/schema` | Zod schemas and types for every stored document and every Gemini output |
| `packages/engine` | Finance engine in integer paise: formulas, categorisation rules, matching, CSV import, the AA consent request and ReBIT statement reader, money lent, the payback plan, monthly flow, the emergency plan, coach templates and the Gemini coach prompt. Shared by browser and (later) Cloud Functions |
| `seed` | Fictional demo account "Rohit", sized to the demo script |

`apps/web/src/lib/actions.ts` mirrors the Cloud Functions in the build workflow (`onTransactionCreated`, `ingestAaData`, `simulatePayment`, `importStatement`, `confirmInvestment`, …), so each can be swapped for a Firebase call one at a time.

## Demo script (5 minutes)

1. **Try the demo as Rohit** → consent screen → **Continue to Demo AA** → pick accounts → **Approve**.
2. Dashboard: press **Swiggy order ₹450** — the AA fetch brings it in ReBIT format and it lands sorted in Food.
3. Press **RK Traders ₹1,200** — it goes to the inbox; the bell shows 1.
4. **Add cash** → type a bill with "Not sure" → it joins the inbox.
5. **Sort game** — drag the bubbles into buckets; points, streak, badges.
6. **Goal** (Plan tab): ₹19,500 a month needed vs ₹17,000 you can save; Food and Entertainment show ₹2,500 of room.
7. Drag the timeline 2 months out → ₹16,800 needed → **On track**.
8. **Invest** tab → pick RD → **Invest now** → **Yes, I paid** → **Demo: bank sends the debit** → confirmed.
9. **Portfolio** — invested, value, and the withdrawable timeline.
10. **Lent and split** — Rohit lent ₹800 to Ramesh (overdue). On Home press **Money from a friend ₹800**: it is spotted as Ramesh paying back, and the card shows where it should go (emergency cushion first).
11. **Coach** in English or हिंदी: “What should I do now?”, “Money came back — where should it go?”, “What do I get for a perfect month?”, “I have an emergency — what do I do?”.
12. **Emergency plan** — how many months the money lasts, what to pause and call back; turn on emergency mode and Home follows.

## Screens

Laid out like a payment app and kept short: Home has the money card, round shortcuts, a "For you today" card (the coach's next steps), the goal, money owed to you and recent activity; detail lives on its own page. Long pages such as Goal are split into tabs. Phones get a back-arrow app bar; wider screens get a sidebar, with account pages under Profile and settings.

| Area | Screens |
|---|---|
| Everyday | Home, History (search, filters, CSV download), Inbox, Add cash, Sort game; tap any payment for a receipt with Share, Split, Lent, note and category |
| Plan | Goal, Portfolio, Coach, Emergency plan |
| Track | Insights (month in review, budgets), Bills and subscriptions (repeating payments, next due date), Lent and split (money lent, paybacks, split bills), Rewards (points, badges, monthly flow) |
| Account | Profile (from the avatar), Bank accounts (balances, AA consents with fetch, pause and revoke), Categories, CSV statement, Settings, Help and safety |

Budgets use each category's limit, or the onboarding estimate when none is set; the bell warns at 80% and 100%.

## Bank statements: Account Aggregator

Bank data comes through RBI's Account Aggregator network. ArthMitra asks for a periodic consent with purpose code 102 (spending patterns and budgets), for `SUMMARY` and `TRANSACTIONS` of `DEPOSIT` accounts only — never `PROFILE` — for 12 months (`consentRequest` in `packages/engine/src/aa.ts`). Every AA delivers the same ReBIT format, so one reader (`readDepositData`) handles every bank; the demo AA sends its payments through it too. CSV upload stays as the fallback for banks not on the network.

Going live needs an integration with an RBI-licensed AA, usually through a technology service provider, and the receiving side (the FIU) must be an entity regulated by RBI, SEBI, IRDAI or PFRDA — ArthMitra itself or a regulated partner.

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
- `COACH_EVALS`: test questions with expected behaviour. The template coach passes all of them in `npm test`; Gemini is scored on the same set once connected.

Crisis, medical and product questions never reach the model: templates answer them, with Tele-MANAS (14416) for crisis.

## Not in this build yet

- Firebase (Auth, Firestore, Functions, Storage), Vertex AI Gemini via Genkit, AA sandbox, FCM, Remote Config, AMFI NAV sync — see the build workflow doc. Needs a Firebase project on Blaze, the Firebase CLI and Java 21 for the emulators.
- Bill reading and free-text coach answers (need Gemini); XLSX import.
- Live AA linking (needs AA sandbox keys on the server) and the Gemini coach flow that uses the training pack.

*Educational guidance, not financial advice. ArthMitra never moves money.*
