import test from "node:test";
import assert from "node:assert/strict";
import { createSubmissionService } from "../src/service.js";

function createStore() {
  let job;
  return {
    async create(values) {
      job = { id: "job-1", ...values };
      return { created: true, job };
    },
    async update(id, changes) {
      assert.equal(id, "job-1");
      Object.assign(job, changes);
      return { ...job };
    },
    scheduled() {
      return [];
    },
  };
}

const config = { zone: "Europe/Amsterdam", form: {} };
const plan = {
  action: "submit",
  startDate: "2026-09-25",
  runAt: "2026-09-25T06:00:00.000+02:00",
};

test("successful submissions notify Discord", async () => {
  const messages = [];
  const service = createSubmissionService({
    config,
    store: createStore(),
    runForm: async () => {},
    notifier: {
      submissionSucceeded: async (details) => messages.push(["success", details]),
      submissionFailed: async (details) => messages.push(["failure", details]),
    },
  });

  const result = await service.submit({ plan, lastSickDate: "2026-09-25" });

  assert.equal(result.job.status, "submitted");
  assert.equal(messages.length, 1);
  assert.equal(messages[0][0], "success");
});

test("failed submissions record the error and notify Discord", async () => {
  const messages = [];
  const service = createSubmissionService({
    config,
    store: createStore(),
    runForm: async () => {
      throw new Error("Microsoft form changed");
    },
    notifier: {
      submissionSucceeded: async (details) => messages.push(["success", details]),
      submissionFailed: async (details) => messages.push(["failure", details]),
    },
  });

  await assert.rejects(
    service.submit({ plan, lastSickDate: "2026-09-25" }),
    /Microsoft form changed/,
  );
  assert.equal(messages.length, 1);
  assert.equal(messages[0][0], "failure");
  assert.equal(messages[0][1].error.message, "Microsoft form changed");
});
