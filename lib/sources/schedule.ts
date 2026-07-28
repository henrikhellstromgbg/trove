import { nextRunFromCron } from "@/lib/pipelines/cron";

// Source schedules are wall-clock local time: a cron of "0 9 * * 0" means 09:00
// in the machine's own timezone, daylight saving included. Trove is local-first,
// so the server evaluating the schedule is the same machine the user picked the
// time on. Pipelines keep evaluating in UTC (nextRunFromCron's default).
export const SOURCE_TIME_ZONE =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export function nextSourceRun(
  cron: string,
  from: Date = new Date()
): Date | null {
  return nextRunFromCron(cron, from, SOURCE_TIME_ZONE);
}
