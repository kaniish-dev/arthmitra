"use client";

import { Chart } from "react-google-charts";
import { toRupees } from "@arthmitra/engine";

/** Google Charts, themed to the Material 3 palette. Every chart sits next to a text version. */
/** Category colours, in order; legends use the same list so dots match the slices. */
export const CHART_COLORS = ["#0b57d0", "#146c2e", "#e37400", "#b3261e", "#6f42c1", "#00796b", "#c2185b", "#5f6368", "#7cacf8", "#9a4d00"];
// The page font, read at render time: next/font gives it a generated family name.
const font = () => (typeof document === "undefined" ? "sans-serif" : getComputedStyle(document.body).fontFamily);

const loader = (
  <div className="flex h-full items-center justify-center text-sm text-on-surface-variant" role="status">
    Loading chart…
  </div>
);

export function CategoryDonut({ rows, height = 240 }: { rows: Array<{ label: string; paise: number }>; height?: number }) {
  return (
    <Chart
      chartType="PieChart"
      width="100%"
      height={`${height}px`}
      loader={loader}
      data={[["Category", "Spent (₹)"], ...rows.map((r) => [r.label, toRupees(r.paise)])]}
      options={{
        pieHole: 0.6,
        legend: "none",
        colors: CHART_COLORS,
        fontName: font(),
        pieSliceText: "none",
        chartArea: { width: "92%", height: "92%" },
        tooltip: { text: "value" },
        backgroundColor: "transparent",
      }}
    />
  );
}

export function ActualVsEstimate({ rows }: { rows: Array<{ label: string; actual: number; estimate: number }> }) {
  return (
    <Chart
      chartType="BarChart"
      width="100%"
      height={`${Math.max(200, rows.length * 44)}px`}
      loader={loader}
      data={[["Category", "Spent (₹)", "Your estimate (₹)"], ...rows.map((r) => [r.label, toRupees(r.actual), toRupees(r.estimate)])]}
      options={{
        colors: ["#006c4c", "#bfc9c2"],
        fontName: font(),
        legend: { position: "top" },
        chartArea: { left: 110, right: 16, top: 32, bottom: 24 },
        hAxis: { format: "₹#,##,##0", gridlines: { color: "#eceeea" } },
        backgroundColor: "transparent",
        bar: { groupWidth: "70%" },
      }}
    />
  );
}

/** Withdrawable timeline (F18): one bar per holding, from purchase to the date the money is free. */
export function WithdrawTimeline({ rows }: { rows: Array<{ label: string; detail: string; start: string; end: string }> }) {
  const asDate = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y!, m! - 1, d!);
  };
  return (
    <Chart
      chartType="Timeline"
      width="100%"
      height={`${rows.length * 44 + 60}px`}
      loader={loader}
      data={[
        [
          { type: "string", id: "Holding" },
          { type: "string", id: "Detail" },
          { type: "date", id: "Start" },
          { type: "date", id: "End" },
        ],
        ...rows.map((r) => {
          const start = asDate(r.start);
          const end = r.end > r.start ? asDate(r.end) : new Date(start.getTime() + 86_400_000);
          return [r.label, r.detail, start, end];
        }),
      ]}
      options={{ colors: CHART_COLORS, timeline: { rowLabelStyle: { fontName: font() }, barLabelStyle: { fontName: font() } }, backgroundColor: "#ffffff" }}
    />
  );
}

/** Month on month: income vs total spend, one pair of bars per month. */
export function MonthBars({ rows }: { rows: Array<{ label: string; income: number; spend: number }> }) {
  return (
    <Chart
      chartType="ColumnChart"
      width="100%"
      height="220px"
      loader={loader}
      data={[["Month", "Income (₹)", "Spent (₹)"], ...rows.map((r) => [r.label, toRupees(r.income), toRupees(r.spend)])]}
      options={{
        colors: ["#146c2e", "#0b57d0"],
        fontName: font(),
        legend: { position: "top" },
        chartArea: { left: 56, right: 8, top: 32, bottom: 28 },
        vAxis: { format: "₹#,##,##0", gridlines: { color: "#eceeea" }, minValue: 0 },
        backgroundColor: "transparent",
        bar: { groupWidth: "70%" },
      }}
    />
  );
}

/** Allocation donut for an investment plan (instrument types and their share). */
export function AllocationDonut({ rows }: { rows: Array<{ label: string; pct: number }> }) {
  return (
    <Chart
      chartType="PieChart"
      width="100%"
      height="220px"
      loader={loader}
      data={[["Instrument", "Share (%)"], ...rows.map((r) => [r.label, r.pct])]}
      options={{
        pieHole: 0.55,
        legend: "none",
        colors: CHART_COLORS,
        fontName: font(),
        pieSliceText: "percentage",
        chartArea: { width: "92%", height: "92%" },
        backgroundColor: "transparent",
      }}
    />
  );
}

/** Projected value over time against the target line. */
export function ProjectionLine({ rows, targetRupees }: { rows: Array<{ label: string; value: number; invested: number }>; targetRupees: number }) {
  return (
    <Chart
      chartType="LineChart"
      width="100%"
      height="220px"
      loader={loader}
      data={[["Year", "Projected value (₹)", "Paid in (₹)", "Target (₹)"], ...rows.map((r) => [r.label, toRupees(r.value), toRupees(r.invested), targetRupees])]}
      options={{
        colors: ["#0b57d0", "#5f6368", "#b3261e"],
        fontName: font(),
        legend: { position: "top" },
        series: { 1: { lineDashStyle: [4, 4] }, 2: { lineDashStyle: [2, 2] } },
        chartArea: { left: 64, right: 8, top: 32, bottom: 28 },
        vAxis: { format: "₹#,##,##0", gridlines: { color: "#eceeea" }, minValue: 0 },
        backgroundColor: "transparent",
      }}
    />
  );
}
