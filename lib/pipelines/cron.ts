import { CronExpressionParser } from "cron-parser";

// Compute the next fire time for a cron. `tz` is the IANA zone the cron's
// wall-clock fields are read in; it defaults to UTC (pipelines) and is set to
// the machine's local zone for sources, so "0 9 * * 0" fires at 09:00 local
// with daylight-saving handled by the parser.
export function nextRunFromCron(
  cron: string,
  from: Date = new Date(),
  tz: string = "UTC"
): Date | null {
  try {
    const interval = CronExpressionParser.parse(cron, {
      currentDate: from,
      tz,
    });
    return interval.next().toDate();
  } catch {
    return null;
  }
}

export function isCronValid(cron: string): boolean {
  try {
    CronExpressionParser.parse(cron);
    return true;
  } catch {
    return false;
  }
}
