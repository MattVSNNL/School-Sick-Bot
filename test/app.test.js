import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";

const apiKey = "a-test-key-that-is-longer-than-thirty-two-characters";
const config = {
  port: 3000,
  zone: "Europe/Amsterdam",
  earliestToday: "06:00",
  todayCutoff: "09:30",
  skipWeekends: true,
  apiKey,
  submitEnabled: false,
  dataFile: ".data/test-jobs.json",
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

async function withServer(run) {
  const app = createApp({
    config,
    submissionService: { submit: async () => { throw new Error("should not submit"); } },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("health endpoint is public", async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  });
});

test("preview rejects a missing API key", async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/preview`, { method: "POST" });
    assert.equal(response.status, 401);
  });
});

test("preview returns a validated plan", async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/preview`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.match(body.startDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(body.lastSickDate, body.startDate);
    assert.equal(body.submitEnabled, false);
  });
});

test("live submission stays locked while disabled", async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/sick`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    });
    assert.equal(response.status, 503);
  });
});
