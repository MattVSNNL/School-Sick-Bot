import { DateTime } from "luxon";
import { runFormAutomation } from "./form.js";

const timers = new Map();

export function createSubmissionService({ config, store }) {
  async function execute(job) {
    await store.update(job.id, { status: "running", error: null });
    try {
      await runFormAutomation(
        config.form,
        { startDate: job.startDate, lastSickDate: job.lastSickDate },
        { submit: true, zone: config.zone },
      );
      return await store.update(job.id, {
        status: "submitted",
        submittedAt: new Date().toISOString(),
      });
    } catch (error) {
      await store.update(job.id, { status: "failed", error: error.message });
      throw error;
    } finally {
      timers.delete(job.id);
    }
  }

  function arm(job) {
    const delay = Math.max(0, DateTime.fromISO(job.runAt).toMillis() - Date.now());
    const timer = setTimeout(() => {
      execute(job).catch((error) => console.error(`Scheduled submission ${job.id} failed:`, error.message));
    }, Math.min(delay, 2_147_483_647));
    timer.unref();
    timers.set(job.id, timer);
  }

  async function submit({ plan, lastSickDate }) {
    const status = plan.action === "schedule" ? "scheduled" : "running";
    const result = await store.create({
      status,
      startDate: plan.startDate,
      lastSickDate,
      runAt: plan.runAt,
    });
    if (!result.created) return { duplicate: true, job: result.job };

    if (plan.action === "schedule") {
      arm(result.job);
      return { duplicate: false, job: result.job };
    }
    return { duplicate: false, job: await execute(result.job) };
  }

  function resume() {
    for (const job of store.scheduled()) arm(job);
  }

  return { submit, resume };
}
