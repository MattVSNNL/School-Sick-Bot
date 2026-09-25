import express from "express";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireApiKey } from "./auth.js";
import { buildDatePlan, validateLastSickDate } from "./date-plan.js";
import { runFormAutomation } from "./form.js";
import { validateConfig } from "./config.js";

const directory = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(directory, "../test/fixtures/mock-form.html");
const fixtureUrl = pathToFileURL(fixturePath).href;

export function createApp({ config, submissionService }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "4kb" }));
  app.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    next();
  });

  app.get("/health", (req, res) => res.json({ ok: true }));
  app.get("/test-form", (req, res) => res.sendFile(fixturePath));
  app.use(requireApiKey(config.apiKey));

  function planRequest(req) {
    const plan = buildDatePlan({
      zone: config.zone,
      earliestToday: config.earliestToday,
      todayCutoff: config.todayCutoff,
      skipWeekends: config.skipWeekends,
    });
    return {
      plan,
      lastSickDate: validateLastSickDate(req.body?.lastSickDate, plan.startDate, config.zone),
    };
  }

  app.post("/preview", (req, res, next) => {
    try {
      const { plan, lastSickDate } = planRequest(req);
      res.json({ ok: true, ...plan, lastSickDate, submitEnabled: config.submitEnabled });
    } catch (error) {
      next(error);
    }
  });

  app.post("/dry-run", async (req, res, next) => {
    try {
      validateConfig(config, { forSubmission: true });
      const { plan, lastSickDate } = planRequest(req);
      const form = { ...config.form, url: fixtureUrl };
      const result = await runFormAutomation(
        form,
        { startDate: plan.startDate, lastSickDate },
        { submit: false, zone: config.zone },
      );
      res.json({ ok: true, mode: "local-fixture", ...result });
    } catch (error) {
      next(error);
    }
  });

  app.post("/sick", async (req, res, next) => {
    try {
      if (req.body?.confirm !== true) {
        return res.status(400).json({ ok: false, error: "Set confirm to true to submit or schedule." });
      }
      if (!config.submitEnabled) {
        return res.status(503).json({ ok: false, error: "Live submission is disabled." });
      }
      validateConfig(config, { forSubmission: true });
      const { plan, lastSickDate } = planRequest(req);
      const result = await submissionService.submit({ plan, lastSickDate });
      const status = result.job.status === "scheduled" ? 202 : 200;
      res.status(status).json({ ok: true, duplicate: result.duplicate, job: result.job });
    } catch (error) {
      next(error);
    }
  });

  app.use((error, req, res, next) => {
    console.error(error.message);
    res.status(400).json({ ok: false, error: error.message });
  });
  return app;
}
