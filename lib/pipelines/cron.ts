import { CronExpressionParser } from "cron-parser";

export function nextRunFromCron(cron: string, from: Date = new Date()): Date | null {
  try {
    const interval = CronExpressionParser.parse(cron, {
      currentDate: from,
      tz: "UTC",
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
