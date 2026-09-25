import test from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { buildDatePlan, validateLastSickDate } from "../src/date-plan.js";

const zone = "Europe/Amsterdam";
const at = (iso) => DateTime.fromISO(iso, { zone });

test("before 06:00 schedules today for 06:00", () => {
  const plan = buildDatePlan({ now: at("2026-09-25T01:30:00"), zone });
  assert.equal(plan.action, "schedule");
  assert.equal(plan.startDate, "2026-09-25");
  assert.match(plan.localRunAt, /T06:00:00/);
});

test("from 06:00 through 09:29 submits for today", () => {
  const plan = buildDatePlan({ now: at("2026-09-25T09:29:59"), zone });
  assert.equal(plan.action, "submit-now");
  assert.equal(plan.startDate, "2026-09-25");
});

test("at 09:30 submits for the next day", () => {
  const plan = buildDatePlan({ now: at("2026-09-24T09:30:00"), zone });
  assert.equal(plan.action, "submit-now");
  assert.equal(plan.startDate, "2026-09-25");
});

test("Friday after cutoff skips the weekend when configured", () => {
  const plan = buildDatePlan({ now: at("2026-09-25T22:00:00"), zone, skipWeekends: true });
  assert.equal(plan.startDate, "2026-09-28");
});

test("Friday after cutoff can target Saturday when weekend skipping is disabled", () => {
  const plan = buildDatePlan({ now: at("2026-09-25T22:00:00"), zone, skipWeekends: false });
  assert.equal(plan.startDate, "2026-09-26");
});

test("last sick day must not precede the start date", () => {
  assert.throws(() => validateLastSickDate("2026-09-24", "2026-09-25", zone), /before startDate/);
});
