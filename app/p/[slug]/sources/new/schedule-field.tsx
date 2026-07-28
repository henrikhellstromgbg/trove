"use client";

import { FieldLabel, Select, SelectItem } from "@/components/ui";
import type { ScheduleFrequency, ScheduleValue } from "./schedule-cron";

const FREQUENCY_OPTIONS: { value: ScheduleFrequency; label: string }[] = [
  { value: "hourly", label: "Every hour" },
  { value: "every6h", label: "Every 6 hours" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// The user's own timezone. Source schedules are evaluated locally on this same
// machine, so showing it here matches when the source will actually run.
const LOCAL_TZ =
  typeof Intl !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : "";

export function ScheduleField({
  value,
  onChange,
}: {
  value: ScheduleValue;
  onChange: (next: ScheduleValue) => void;
}) {
  const showHour =
    value.frequency === "daily" ||
    value.frequency === "weekly" ||
    value.frequency === "monthly";
  const showWeekday = value.frequency === "weekly";
  const showDayOfMonth = value.frequency === "monthly";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="schedule-frequency">Check</FieldLabel>
        <Select
          id="schedule-frequency"
          value={value.frequency}
          onValueChange={(f) =>
            onChange({ ...value, frequency: f as ScheduleFrequency })
          }
        >
          {FREQUENCY_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </Select>
      </div>

      {showWeekday ? (
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="schedule-weekday">On</FieldLabel>
          <Select
            id="schedule-weekday"
            value={String(value.weekday)}
            onValueChange={(d) => onChange({ ...value, weekday: Number(d) })}
          >
            {WEEKDAYS.map((label, i) => (
              <SelectItem key={label} value={String(i)}>
                {label}
              </SelectItem>
            ))}
          </Select>
        </div>
      ) : null}

      {showDayOfMonth ? (
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="schedule-dom">On day</FieldLabel>
          <Select
            id="schedule-dom"
            value={String(value.dayOfMonth)}
            onValueChange={(d) => onChange({ ...value, dayOfMonth: Number(d) })}
          >
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <SelectItem key={d} value={String(d)}>
                {d}
              </SelectItem>
            ))}
          </Select>
        </div>
      ) : null}

      {showHour ? (
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="schedule-hour">At</FieldLabel>
          <Select
            id="schedule-hour"
            value={String(value.hour)}
            onValueChange={(h) => onChange({ ...value, hour: Number(h) })}
          >
            {Array.from({ length: 24 }, (_, i) => i).map((h) => (
              <SelectItem key={h} value={String(h)}>
                {String(h).padStart(2, "0")}:00
              </SelectItem>
            ))}
          </Select>
          <p className="text-sm text-[var(--color-text-tertiary)]">
            {LOCAL_TZ ? `Runs in your local time (${LOCAL_TZ}).` : "Runs in your local time."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
