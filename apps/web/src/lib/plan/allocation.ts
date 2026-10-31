import {
  allocate as allocateWith,
  blendedReturnPct as blendWith,
  buildPlan as buildWith,
  timelineFor as timelineWith,
  type PlanInput,
} from "@arthmitra/engine";
import type { AllocationLine, RiskComfort, Timeline } from "@arthmitra/schema";
import { ALLOCATION_CONFIG, TIMELINE_CONFIG } from "@/config/plan";

/**
 * Allocation mapping for the app, using the editable tables in config/plan.ts. The maths
 * lives in @arthmitra/engine (allocation.ts) where it is unit-tested.
 *
 * Low: FDs, RDs, gold, bonds, G-Secs, treasury bills · Medium: debt/hybrid funds, index funds,
 * gold, some FD/RD · High: equity funds, index funds, direct stocks. Short timelines cap equity.
 */
export const allocate = (risk: RiskComfort, timeline: Timeline): AllocationLine[] => allocateWith(risk, timeline, ALLOCATION_CONFIG);

export const blendedReturnPct = (lines: AllocationLine[]) => blendWith(lines, ALLOCATION_CONFIG);

export const buildPlan = (input: PlanInput) => buildWith(input, ALLOCATION_CONFIG);

export const timelineFor = (monthsLeft: number) => timelineWith(monthsLeft, TIMELINE_CONFIG);

export const assumedReturnPct = (type: AllocationLine["type"]) => ALLOCATION_CONFIG.returnsPct[type];

/** Years a Wealth Generator plan aims for at each timeline. */
export const wealthYears = (timeline: Timeline) => TIMELINE_CONFIG.wealthYears[timeline];
