// A source schedule as picker state, plus the pure mapping to a standard
// 5-field cron. Kept free of any React/UI import so the mapping stays unit
// testable on its own (mirrors source-form-data.ts). The cron is wall-clock:
// source schedules are evaluated in the machine's local timezone (see
// lib/sources/schedule.ts), so `hour` means local time, DST included.

export type ScheduleFrequency =
  | "hourly"
  | "every6h"
  | "daily"
  | "weekly"
  | "monthly";

export type ScheduleValue = {
  frequency: ScheduleFrequency;
  hour: number; // 0-23, UTC
  weekday: number; // 0-6, Sunday = 0 (cron day-of-week)
  dayOfMonth: number; // 1-28, capped so no month is ever skipped
};

// Default keeps the previous behaviour: an hourly check. The hour/weekday/day
// fields are seeded so switching to daily/weekly/monthly lands on a sane value.
export const DEFAULT_SCHEDULE: ScheduleValue = {
  frequency: "hourly",
  hour: 8,
  weekday: 0,
  dayOfMonth: 1,
};

// Build a valid cron from the picker state. Pure and total: every branch of
// ScheduleFrequency returns a 5-field expression.
export function buildScheduleCron(v: ScheduleValue): string {
  switch (v.frequency) {
    case "hourly":
      return "0 * * * *";
    case "every6h":
      return "0 */6 * * *";
    case "daily":
      return `0 ${v.hour} * * *`;
    case "weekly":
      return `0 ${v.hour} * * ${v.weekday}`;
    case "monthly":
      return `0 ${v.hour} ${v.dayOfMonth} * *`;
  }
}
