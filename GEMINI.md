# Context for Gemini CLI and Antigravity agents

ArthMitra: track every payment, sort it, and plan one savings goal. Next.js 16 + Firebase + Gemini (Vertex AI via Genkit). npm workspaces.

## Rules that must never break

- Money is **integer paise** everywhere. Convert only with `toPaise()` / `formatINR()` from `@arthmitra/engine`. Display en-IN (`₹1,23,456.00`), dates as `29 Oct 2026`.
- Every number shown to a user comes from `packages/engine`. Gemini only classifies, reads bills and explains figures it is given.
- Never name a specific fund, stock or insurance product; never promise or pre-fill a return. Instrument suggestions are the generic per-horizon table in `instruments.ts`. Gold means gold ETF / gold mutual fund, never "digital gold".
- Every suggestion and coach answer carries "Educational guidance, not financial advice."
- Never collect bank passwords, UPI PINs, OTPs or full account numbers (last 4 digits only).
- Gemini never receives names, emails or account numbers — merchant text, amounts, bill images and aggregates only.
- ArthMitra never moves money.
- Bank data comes only through the Account Aggregator: purpose 102, `SUMMARY` + `TRANSACTIONS` of `DEPOSIT` accounts. Never request `PROFILE`. Read FI data only with `readDepositData()`.
- The coach is a money coach over the whole structure (balance, bills, emergency cushion, money lent, goal, monthly flow, emergency plan). The engine computes every figure, including where returned money goes (`planForMoney`); the coach only explains, offers buttons from `COACH_ACTIONS`, and every AI answer must pass `checkCoachAnswer()`.
- ArthMitra never asks anyone for money: loans are records, paybacks are spotted in the bank feed, reminders are text the user sends.
- No medical, mental-health, legal or tax advice. Crisis questions get the template answer with Tele-MANAS (14416) and 112 before any model call.

## Where things live

- `packages/schema` — Zod types; add a field here first.
- `packages/engine` — pure functions with Vitest tests next to them; every PRD formula has a test.
- `seed` — fictional demo data; its tests pin the demo-script numbers.
- `apps/web/src/lib/actions.ts` — demo-mode versions of the Cloud Functions.
- `apps/web/src/screens` — one client component per screen; `src/app` holds thin route files.

Run `npm test`, `npm run typecheck` and `npm run lint` before proposing a change.
