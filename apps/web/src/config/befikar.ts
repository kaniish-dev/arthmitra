/**
 * Befikar Mode (Freedom Date) is a vision feature: these are illustrative sample values for
 * the coming-soon screen, not a live calculation.
 */
export const BEFIKAR_SAMPLE = {
  persona: "Sample: 24-year-old saving every month from today",
  monthlyExpensesRupees: 30_000,
  passiveIncomeTodayRupees: 4_200,
  freedomDate: "2047-03-01",
  ageAtFreedom: 45,
  /** How saving more each month brings the date closer. */
  scenarios: [
    { monthlyRupees: 10_000, freedomDate: "2051-06-01", age: 49 },
    { monthlyRupees: 15_000, freedomDate: "2047-03-01", age: 45 },
    { monthlyRupees: 25_000, freedomDate: "2042-09-01", age: 40 },
  ],
  /** "Start early" comparison: same ₹10,000 a month, started at different ages. */
  startEarly: [
    { startAge: 22, corpusAt50Rupees: 3_20_00_000 },
    { startAge: 30, corpusAt50Rupees: 1_25_00_000 },
  ],
};
