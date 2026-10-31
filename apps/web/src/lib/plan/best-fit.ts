import type { InstrumentType } from "@arthmitra/schema";
import { ALLOCATION_CONFIG } from "@/config/plan";

/** Best-fit picker for the app: the ranking rule and checklists live in @arthmitra/engine (picker.ts), unit-tested there. */
export { CHECKLIST, INSTRUMENTS, INSTRUMENT_LABEL, rankFits, scoreFit, type Fit } from "@arthmitra/engine";

export const assumedReturnPctFor = (type: InstrumentType) => ALLOCATION_CONFIG.returnsPct[type];
