import test from "node:test";
import assert from "node:assert/strict";
import { createDiscordNotifier } from "../src/notifications.js";

test("Discord notifier sends a success message without private form data", async () => {
  let request;
  const notifier = createDiscordNotifier({
    webhookUrl: "https://discord.com/api/webhooks/test/token",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 204 };
    },
  });

  const result = await notifier.submissionSucceeded({
    startDate: "2026-09-25",
    lastSickDate: "2026-09-25",
  });

  assert.deepEqual(result, { sent: true });
  assert.equal(request.url, "https://discord.com/api/webhooks/test/token");
  const body = JSON.parse(request.options.body);
  assert.match(body.content, /Ziekmelding verzonden/);
  assert.match(body.content, /2026-09-25/);
  assert.deepEqual(body.allowed_mentions, { parse: [] });
});

test("Discord notifier stays disabled when no webhook is configured", async () => {
  let called = false;
  const notifier = createDiscordNotifier({
    webhookUrl: "",
    fetchImpl: async () => {
      called = true;
      return { ok: true, status: 204 };
    },
  });

  const result = await notifier.submissionFailed({
    startDate: "2026-09-25",
    lastSickDate: "2026-09-25",
    error: new Error("test failure"),
  });

  assert.deepEqual(result, { sent: false, reason: "disabled" });
  assert.equal(called, false);
});

test("Discord errors are contained and do not throw", async () => {
  const errors = [];
  const notifier = createDiscordNotifier({
    webhookUrl: "https://discord.com/api/webhooks/test/token",
    fetchImpl: async () => ({ ok: false, status: 429 }),
    logger: { error: (message) => errors.push(message) },
  });

  const result = await notifier.submissionFailed({
    startDate: "2026-09-25",
    lastSickDate: "2026-09-25",
    error: new Error("form changed"),
  });

  assert.equal(result.sent, false);
  assert.match(result.error, /HTTP 429/);
  assert.equal(errors.length, 1);
});
