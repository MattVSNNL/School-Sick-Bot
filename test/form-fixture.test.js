import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { fillSickForm, launchBrowser } from "../src/form.js";

const directory = path.dirname(fileURLToPath(import.meta.url));
const fixture = pathToFileURL(path.join(directory, "fixtures/mock-form.html")).href;
const form = {
  url: fixture,
  studentNumber: "123456",
  firstName: "Test",
  lastName: "Student",
  birthDate: "2000-01-31",
  programme: "Software Developer niveau 4",
  applicant: "Student",
  phoneNumber: "0612345678",
  wantsPhoneContact: "Nee",
};

test("fills the identical local form without submitting", async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await fillSickForm(
      page,
      form,
      { startDate: "2026-09-25", lastSickDate: "2026-09-26" },
      { submit: false },
    );
    assert.equal(await page.locator('[data-automation-id="questionItem"]').filter({ hasText: "Studentnummer" }).locator("input").inputValue(), "123456");
    assert.equal(await page.locator('input[value="Ziek"]').isChecked(), true);
    assert.equal(await page.locator("body").getAttribute("data-submitted"), "false");
  } finally {
    await browser.close();
  }
});

test("submits only when explicitly requested and verifies confirmation", async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await fillSickForm(
      page,
      form,
      { startDate: "2026-09-25", lastSickDate: "2026-09-25" },
      { submit: true },
    );
    assert.equal(await page.locator("body").getAttribute("data-submitted"), "true");
  } finally {
    await browser.close();
  }
});
