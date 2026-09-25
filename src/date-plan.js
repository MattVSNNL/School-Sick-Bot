import { DateTime } from "luxon";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseClock(value, name) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error(`${name} must use HH:mm format`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error(`${name} is not a valid time`);
  return { hour, minute };
}

function nextAllowedSchoolDay(date, skipWeekends) {
  let candidate = date;
  while (skipWeekends && candidate.weekday > 5) {
    candidate = candidate.plus({ days: 1 });
  }
  return candidate;
}

export function buildDatePlan({
  now = DateTime.now(),
  zone = "Europe/Amsterdam",
  earliestToday = "06:00",
  todayCutoff = "09:30",
  skipWeekends = true,
} = {}) {
  const localNow = DateTime.isDateTime(now)
    ? now.setZone(zone)
    : DateTime.fromJSDate(now, { zone });
  if (!localNow.isValid) throw new Error(`Invalid date/time: ${localNow.invalidReason}`);

  const earliest = parseClock(earliestToday, "EARLIEST_TODAY");
  const cutoff = parseClock(todayCutoff, "TODAY_CUTOFF");
  const earliestAt = localNow.startOf("day").set(earliest);
  const cutoffAt = localNow.startOf("day").set(cutoff);
  if (cutoffAt <= earliestAt) throw new Error("TODAY_CUTOFF must be later than EARLIEST_TODAY");

  if (localNow < earliestAt) {
    return {
      action: "schedule",
      startDate: localNow.toISODate(),
      runAt: earliestAt.toUTC().toISO(),
      localRunAt: earliestAt.toISO(),
      reason: "A report for today is only processed from the opening time.",
    };
  }

  if (localNow < cutoffAt) {
    return {
      action: "submit-now",
      startDate: localNow.toISODate(),
      runAt: localNow.toUTC().toISO(),
      localRunAt: localNow.toISO(),
      reason: "The report is within today's processing window.",
    };
  }

  const target = nextAllowedSchoolDay(localNow.startOf("day").plus({ days: 1 }), skipWeekends);
  return {
    action: "submit-now",
    startDate: target.toISODate(),
    runAt: localNow.toUTC().toISO(),
    localRunAt: localNow.toISO(),
    reason: "The cutoff has passed, so the report starts on the next configured school day.",
  };
}

export function validateLastSickDate(value, startDate, zone = "Europe/Amsterdam") {
  const last = value ?? startDate;
  if (!ISO_DATE.test(last)) throw new Error("lastSickDate must use YYYY-MM-DD format");
  const start = DateTime.fromISO(startDate, { zone });
  const end = DateTime.fromISO(last, { zone });
  if (!end.isValid) throw new Error("lastSickDate is not a valid date");
  if (end < start) throw new Error("lastSickDate cannot be before startDate");
  if (end.diff(start, "days").days > 31) {
    throw new Error("lastSickDate cannot be more than 31 days after startDate");
  }
  return last;
}

export function toMicrosoftDate(isoDate, zone = "Europe/Amsterdam") {
  const date = DateTime.fromISO(isoDate, { zone });
  if (!date.isValid) throw new Error(`Invalid ISO date: ${isoDate}`);
  return date.toFormat("M/d/yyyy");
}
