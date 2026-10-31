import { addDays, addMonths, todayIso } from "@arthmitra/engine";
import type { PersonaId } from "@arthmitra/seed";

/**
 * Demo walk-through: the persona picked on the login screen, remembered for this tab, so every
 * form along the way (sign-up, KYC, bank, plan, lend…) can offer an "Autofill" button with that
 * persona's fictional values. Nothing here is real data.
 */
const KEY = "arthmitra:demo-persona";

export function setDemoPersona(id: PersonaId | null) {
  try {
    if (id) sessionStorage.setItem(KEY, id);
    else sessionStorage.removeItem(KEY);
  } catch {
    // Storage blocked: autofill buttons fall back to the adult persona.
  }
}

export function demoPersona(): PersonaId | null {
  try {
    const v = typeof sessionStorage === "undefined" ? null : sessionStorage.getItem(KEY);
    return v === "adult" || v === "minor" ? v : null;
  } catch {
    return null;
  }
}

const yearsAgo = (years: number, days: number) => addDays(addMonths(todayIso(), -12 * years), -days);

/** Fictional values for each step, per persona. The Aadhaar numbers are made up and only their last 4 digits are kept. */
export function demoValues(id: PersonaId = demoPersona() ?? "adult") {
  const minor = id === "minor";
  return {
    basic: {
      name: minor ? "Ananya Rao" : "Aarav Mehta",
      dob: minor ? yearsAgo(16, 40) : yearsAgo(24, 75),
      email: minor ? "ananya.demo@example.com" : "aarav.demo@example.com",
      mobile: minor ? "9800000016" : "9800000024",
    },
    kyc: minor
      ? { guardianName: "Sunita Rao", relation: "mother" as const, pan: "SUNRA9876K", aadhaar: "987654325678" }
      : { guardianName: "", relation: "mother" as const, pan: "ABCDE4321F", aadhaar: "234567891234" },
    bank: minor
      ? { holder: "Ananya Rao", number: "30012345677710", ifsc: "SBIN0001234" }
      : { holder: "Aarav Mehta", number: "50100234564821", ifsc: "HDFC0004321" },
    loan: { person: minor ? "Kavya Singh" : "Rahul Verma", amountPaise: minor ? 30_000 : 200_000, note: minor ? "Canteen lunch" : "Goa trip advance" },
  };
}

/** A small bank statement as CSV text, for trying the real statement parser. */
export function sampleStatementCsv(id: PersonaId = demoPersona() ?? "adult"): string {
  const minor = id === "minor";
  const rows: string[] = ["Date,Description,Debit,Credit"];
  const today = todayIso();
  for (let m = 6; m >= 1; m--) {
    const first = addMonths(`${today.slice(0, 7)}-01`, -m);
    const d = (day: number) => {
      const [y, mo] = first.split("-");
      return `${String(day).padStart(2, "0")}/${mo}/${y}`;
    };
    if (minor) {
      rows.push(`${d(1)},UPI-SUNITA RAO-POCKET MONEY,,4000.00`);
      rows.push(`${d(4)},UPI/SPOTIFY STUDENT,59.00,`);
      rows.push(`${d(8)},UPI/JIO RECHARGE,299.00,`);
      rows.push(`${d(11)},UPI/SWIGGY ORDER,${180 + m * 10}.00,`);
      rows.push(`${d(15)},UPI/DELHI METRO RECHARGE,200.00,`);
      rows.push(`${d(19)},UPI/AMAZON PAY,${350 + m * 25}.00,`);
      rows.push(`${d(23)},UPI-KAVYA SINGH,150.00,`);
    } else {
      rows.push(`${d(1)},NEFT-SALARY-BRIGHTLEAF SOFTWARE,,58000.00`);
      rows.push(`${d(3)},UPI-RENT-MR ANIL KAPOOR,15000.00,`);
      rows.push(`${d(5)},ACH-PHONE EMI,2499.00,`);
      rows.push(`${d(7)},UPI/AIRTEL BROADBAND,699.00,`);
      rows.push(`${d(9)},NETFLIX.COM,649.00,`);
      rows.push(`${d(10)},UPI/SWIGGY ORDER,${420 + m * 30}.00,`);
      rows.push(`${d(12)},POS DMART,${1500 + m * 40}.00,`);
      rows.push(`${d(14)},UPI/UBER INDIA,${300 + m * 15}.00,`);
      rows.push(`${d(18)},UPI/ZOMATO,${560 + m * 20}.00,`);
      rows.push(`${d(21)},UPI/MYNTRA,${1200 + m * 80}.00,`);
      rows.push(`${d(24)},UPI-RAHUL VERMA,800.00,`);
    }
  }
  return rows.join("\n");
}

