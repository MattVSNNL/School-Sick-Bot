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

const config = {
  port: 3000,
  apiKey: "a-test-key-that-is-longer-than-thirty-two-characters",
  zone: "Europe/Amsterdam",
  form: {
    url: "https://example.invalid/form",
    studentNumber: "123456",
    firstName: "Test",
    lastName: "Student",
    birthDate: "2000-01-31",
    programme: "Software Developer niveau 4",
    applicant: "Student",
    phoneNumber: "0612345678",
    wantsPhoneContact: "Nee",
  },
};
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
      duplicateBlocked: async (details) => messages.push(["duplicate", details]),
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
      duplicateBlocked: async (details) => messages.push(["duplicate", details]),
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

test("duplicate submissions notify Discord without running the form again", async () => {
  const messages = [];
  let formRuns = 0;
  const existing = {
    id: "job-existing",
    status: "submitted",
    startDate: "2026-09-25",
    lastSickDate: "2026-09-25",
  };
  const service = createSubmissionService({
    config,
    store: {
      create: async () => ({ created: false, job: existing }),
      scheduled: () => [],
    },
    runForm: async () => {
      formRuns += 1;
    },
    notifier: {
      submissionSucceeded: async (details) => messages.push(["success", details]),
      submissionFailed: async (details) => messages.push(["failure", details]),
      duplicateBlocked: async (details) => messages.push(["duplicate", details]),
    },
  });

  const result = await service.submit({ plan, lastSickDate: "2026-09-25" });

  assert.equal(result.duplicate, true);
  assert.equal(formRuns, 0);
  assert.deepEqual(messages, [["duplicate", existing]]);
});

test("missing form settings notify Discord before creating a job", async () => {
  const messages = [];
  const service = createSubmissionService({
    config: { ...config, form: { ...config.form, url: "" } },
    store: {
      create: async () => {
        throw new Error("should not create a job");
      },
      scheduled: () => [],
    },
    notifier: {
      submissionSucceeded: async (details) => messages.push(["success", details]),
      submissionFailed: async (details) => messages.push(["failure", details]),
      duplicateBlocked: async (details) => messages.push(["duplicate", details]),
    },
  });

  await assert.rejects(
    service.submit({ plan, lastSickDate: "2026-09-25" }),
    /Missing form settings: url/,
  );
  assert.equal(messages.length, 1);
  assert.equal(messages[0][0], "failure");
});
