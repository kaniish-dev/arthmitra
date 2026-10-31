# AI and machine learning in ArthMitra

ArthMitra uses **four models**, one for each key moment in the journey: *understand my spending → stay safe → plan a goal → ask for advice*. The rules and maths decide every rupee figure (saving target, SIP amount, allocation). The models learn the user's own patterns, and Gemini explains.

| # | Model | Technique | Where it runs | Where the user sees it |
|---|---|---|---|---|
| 1 | **Smart sorting** | TF-IDF features + k-nearest neighbours (classification) | On the device | Payments sort themselves; every number on Home depends on it |
| 2 | **Unusual-payment check** | Median + MAD outlier test per category (anomaly detection), with user feedback | On the device | "Was this you?" on the bell and Insights: **This was me** / **Not me** (1930 helpline) |
| 3 | **Goal success odds + this year's outlook** | Monte Carlo simulation, 2,000 log-normal market paths | On the device | Plan screen: "92% chance", bad / typical / good outcome, and the next-12-months range |
| 4 | **Gemini money coach** | Google Gemini LLM, grounded on the user's summary and checked before showing | Server route (`/api/coach`, `/api/insights`, `/api/research/explain`) | Coach chat; Home → "Realistic monthly saving" explanation and 2 tips; Plan → "Research this category" summary |

**Why these four.**
- Sorting feeds every insight on Home.
- Fraud alerts protect users who live on UPI.
- Goal odds turn a plan into a decision.
- Gemini is the "AI money coach" the product is named for, and the Google AI part of the hackathon.

Models 1–3 keep bank data on the device. Model 4 only ever sees totals.

**Deploying.** Nothing extra to host or pay for. Models 1–3 ship inside the web app and run in the browser. Model 4 runs in Next.js route handlers that deploy with the app on Firebase App Hosting. The only setting is the `GEMINI_API_KEY` secret (in `apphosting.yaml`), and the Gemini free tier is enough. If Gemini is down or rate-limited, the Coach and the saving card fall back to templates, so the demo never breaks.

Code:
- [`packages/engine/src/ml.ts`](../packages/engine/src/ml.ts) — models 1 and 2
- [`montecarlo.ts`](../packages/engine/src/montecarlo.ts) — model 3
- [`apps/web/src/app/api/coach`](../apps/web/src/app/api/coach/route.ts), [`api/insights`](../apps/web/src/app/api/insights/route.ts) and [`api/research/explain`](../apps/web/src/app/api/research/explain/route.ts), with [`coach-prompt.ts`](../packages/engine/src/coach-prompt.ts) — model 4

Tests: `ml.test.ts`, `montecarlo.test.ts`, `coach.test.ts`, `coach-goals.test.ts` (run with `npm test`).

---

## 1. Smart sorting — "it learns from you"

**What.** A classifier that puts each payment into a category (Food, Groceries, Rent…) from the shop's name.

**Why.** Fixed rules know "Swiggy = Food", but not your local "Shree RK Traders". Without sorting, the fixed vs variable split, spend by category and the realistic saving would all be wrong.

**How.**
1. The name is broken into words and 3-letter pieces, so "RK Traders", "R K Traders" and "RKTraders" still match.
2. Rare pieces count more (TF-IDF).
3. The model finds the 5 shops you already sorted that look most alike (cosine similarity, k-nearest neighbours), and they vote.
4. A sure vote (≥ 80% confidence by default) sorts the payment. Otherwise it waits in the Inbox with the model's guess first.

Every correction is a new training example straight away, and retraining takes milliseconds.

**Real example.** Aarav pays "UPI-RK TRADERS ₹1,200". No rule knows it, so it goes to the Inbox, and he taps Groceries. A week later "UPI-SHREE RK TRADERS ₹350" arrives and sorts itself into Groceries.

---

## 2. Unusual-payment check — "was this you?"

**What.** Anomaly detection that flags a payment far outside your own usual amount in that category.

**Why.** A fixed limit like "alert above ₹5,000" is wrong for everyone: too low for rent, too high for a student. UPI fraud often shows up as one unusually big payment, and catching it the same day matters.

**How.**
1. Over the last 120 days of the category (at least 5 payments), the usual amount is the median and the normal spread is the MAD (median absolute deviation). Both are robust, so one odd payment can't skew them.
2. An alert is raised only if the payment is:
   - more than 4 spreads above the usual amount,
   - at least 3× the usual amount,
   - at least 1.5× the biggest earlier payment in the category,
   - and at least ₹1,000.

   So a busy weekend doesn't raise an alarm.

**Real example.** Ananya's food payments are usually about ₹150. A ₹6,500 restaurant payment asks: *"Was this you? ₹6,500 … about 40× your usual Food payment. A party or a big day is fine — tap This was me. If you didn't make it, call 1930 now."* A ₹400 pizza asks nothing.

**It learns from the answer (human in the loop).** It never blocks money and never calls anything fraud on its own.
- **This was me** clears the alert, and the payment counts as normal from then on, so next month's similar party bill isn't flagged.
- **Not me** keeps it flagged and shows what to do: call 1930 and ask the bank to block the card or UPI.

---

## 3. Goal success odds — "what are my chances?"

**What.** A Monte Carlo simulation of 2,000 possible market paths for the user's exact plan.

**Why.** A single projection ("₹1,52,000 by May 2028") hides risk. An FD plan and an equity plan can show the same number, but only one can fall 20% in a bad year. Odds make the timeline and risk choice real, which is what a good adviser explains.

**How.**
- Each instrument has its assumed return (shown on the plan) and a volatility:
  - FD 0%
  - debt funds about 3%
  - index funds about 17%
  - direct stocks about 26%
- Month by month, each instrument grows in its own pot with a random shock, so a crash in shares doesn't touch the FD.
- The share of paths that end at or above the target is the probability.
- The 10th, 50th and 90th percentile endings are shown as "bad market", "typical" and "good market".
- It is seeded, so the same plan always shows the same figure.

**This year's outlook.** The same simulation, run for the next 12 months only (or until the goal, if that is sooner). It shows:
- the range of values the plan could reach by then: bad year, most likely, good year;
- the chance of still being on track, meaning the value is enough that the same monthly amount still reaches the goal on time;
- the chance of ending the year below what was paid in.

It is labelled "Projection, not a prediction": it does not forecast where markets go, it shows what a typical range of years looks like for this mix.

**Real example.** Aarav's Dream Vacation, ₹1,50,000 in 18 months:
- At Medium risk on a short timeline (mostly RD and FD) it shows about **92%**, and even a bad market ends close to the target.
- If he forces High risk, the typical outcome is a bit higher but the odds can drop to about **60%**, because a bad year near the end could leave him short.

The ring makes that trade-off obvious in a second.

---

## 4. Gemini money coach — grounded advice

**What.** Google Gemini, used in three places:
1. **The Coach chat**: answers money questions about the user's own situation.
2. **The saving card on Home**: a 2–3 line explanation of the realistic saving, plus 2 tips.
3. **Category research on a plan**: a 2–3 line read of the fund shortlist (how the funds compare with their peers, and the trade-off to notice). The shortlist itself is a rule-based ranking (see "Does ArthMitra pick funds?" below); Gemini only explains it.

**Why.** People don't act on tables; they act on a friendly explanation that fits their life. Gemini turns the engine's numbers into plain words, in English, Hinglish or हिंदी.

**Guardrails.**
- Gemini receives only a computed summary: category totals, the realistic saving, each plan's monthly amount and progress, portfolio value. Never PAN, Aadhaar, account numbers or friends' names (those become "Person 1", "Person 2").
- Every answer is checked. It is rejected if it has a rupee figure not in the summary, a named fund or stock, a promised return, or a button outside a fixed list. The template answer is used instead.
- Crisis, medical and "which fund should I buy" questions never reach Gemini.
- The research summary gets only public fund figures (no user data beyond time frame and risk). It is rejected if it quotes a percentage not in that input, or uses advice words ("recommend", "you should buy", "guaranteed"); the panel then shows the rule-based reasons alone.
- The "Educational guidance, not investment advice" disclaimer is always added.

**Real examples.**
- Ananya asks *"I want to buy a refrigerator worth 30k in the next 3 months."* The engine works out ₹30,000 ÷ 3 = ₹10,000 a month and checks it against her free saving. Gemini phrases the answer, and a button turns it into a savings goal.
- On Home: *"You usually keep about ₹17,700 a month, so ₹14,000 leaves a cushion for surprises. Food at ₹5,100 is your biggest variable spend — one less order a week helps."*

---

## Show it in the demo (about 1 minute)

Use **Walk through every step** (or **Skip to ready account**) on the login screen. The demo checklist on Home has a **Try the AI models** panel:

1. **New shop: RK Traders ₹1,200** — it goes to the Inbox. Sort it as **Groceries**.
2. **Similar shop: Shree RK Traders ₹350** — it sorts itself (model 1).
3. **Fraud test: ₹6,500 dinner** — the bell shows the unusual-payment alert with 1930 (model 2).
4. **Plan something** → save a plan — the **Chance of reaching your goal** ring appears (model 3). Change the risk and watch it move.
5. **Coach** → *"Can I afford a 40k trip in March?"*, and the Home saving card (model 4).

## Likely mentor questions

**Is this real ML or just rules?**
Real models. Smart sorting is a trained classifier that changes as it learns from the user. The fraud detector is a statistical model fitted to each user's own history. Goal odds come from a stochastic simulation. None of the thresholds are hand-picked per shop or per user.

**Why not send everything to Gemini?**
Privacy and reliability. Bank-level data stays on the device (India's DPDP Act), the on-device models are instant, free and work offline, and the maths can't hallucinate. Gemini does what it's best at: language.

**What about a brand-new user?**
- Sorting starts from about 100 built-in keywords.
- The fraud detector stays silent until there are 5 payments in a category, so there are no false alarms.
- Goal odds work from the first plan.
- The Coach falls back to templates when there's little data.

**How does it decide FD vs RD vs savings, and the tenure?**
A goal-based savings recommendation engine (`packages/engine/src/recommend.ts`). Like the picker below, it is rules, not a model.
1. It classifies the intent: monthly, lump sum, periodic, mixed or emergency.
2. It applies hard constraints from the product data: minimum deposit, a tenure that matures by the goal date, monthly instalments for an RD, the ability to commit, early-access needs.
3. It ranks only the products that pass, then checks the goal on principal alone (interest never closes a gap).

Two examples:
- ₹5,000 a month for 3 months goes to a savings account, because an RD's shortest tenure is 6 months and an FD can't take monthly deposits.
- ₹50,000 today for 6 months goes to a 6-month FD.

**Does ArthMitra pick funds?**
It shows research, not recommendations. The plan splits money by category; under each category, **Research this category** lists the 3 funds that score best among their peers on published criteria (`packages/engine/src/research.ts`, settings in `apps/web/src/config/research.ts`):
- Peer group from AMFI categories (for example all Nifty 50 index funds and ETFs, or all flexi cap funds), direct plan, growth option, at least 3 years of NAV history.
- Return over the goal's window (1 year for goals under 3 years, else 3-year CAGR), expense ratio, volatility and worst fall over 3 years, each as a percentile among peers. Index and gold funds hold the same thing, so they rank on cost and return only.
- Every reason quotes the figure next to the peer median, so anyone can check it.

The list is the same for everyone with the same time frame and risk, rupee amounts stay per category, and individual stocks are never shortlisted (stocks get research criteria instead): picking securities for a person is regulated investment advice in India (SEBI Investment Adviser / Research Analyst rules). Data: daily NAVs from AMFI (via mfapi.in, refreshed live for the leaders and cached 6 hours) and expense ratios from AMFI's TER disclosures, over a dated snapshot rebuilt with `npm run research:snapshot -w web`. Fund size (AUM) and exchange trading data for ETFs need a licensed feed and are future add-ons.

**How does ArthMitra suggest where to invest?**
Through the plan's allocation and a **best-fit picker** (`packages/engine/src/picker.ts`). The picker is a transparent scoring rule, not a fifth model. It scores each category, from FD and RD to index funds, on:
- time frame,
- risk appetite,
- whether the user saves monthly,
- access to money,
- deposit insurance.

It shows the top 3 with reasons, a "what to look for" checklist (rate, lock-in, penalty, DICGC cover, expense ratio…), and a link to the partner app for that category. The picker itself never names a bank, fund or platform. Named funds appear only in **Research this category**, as research on published criteria, never as a pick for the user (see "Does ArthMitra pick funds?").

**What would you add next?**
- Learning across many users without sharing their data (federated learning).
- Spotting subscriptions that quietly change price.
- A spending forecast once there is enough history.
