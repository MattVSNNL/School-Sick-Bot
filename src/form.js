import { chromium } from "playwright";
import fs from "node:fs";
import { toMicrosoftDate } from "./date-plan.js";

function localExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate));
}

export function launchBrowser() {
  const executablePath = process.platform === "win32" ? localExecutable() : undefined;
  return chromium.launch({
    headless: true,
    executablePath,
    args: ["--disable-dev-shm-usage"],
  });
}

function question(page, text) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const heading = page.getByRole("heading", {
    name: new RegExp(escaped, "i"),
  });
  return page
    .locator('[data-automation-id="questionItem"]')
    .filter({ has: heading })
    .filter({ has: page.locator("input") })
    .first();
}

async function fillText(page, questionText, value) {
  const item = question(page, questionText);
  await item.locator('input[data-automation-id="textInput"], input[type="text"]').first().fill(value);
}

async function fillDate(page, questionText, isoDate, zone) {
  const item = question(page, questionText);
  const input = item.locator('input[role="combobox"], input[type="date"]').first();
  const type = await input.getAttribute("type");
  const value = type === "date" ? isoDate : toMicrosoftDate(isoDate, zone);
  await input.fill(value);
  await input.press("Tab");
}

async function choose(page, questionText, value) {
  const item = question(page, questionText);
  const escaped = value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  const input = item.locator(`input[type="radio"][value="${escaped}"]`);
  const labelledBy = await input.getAttribute("aria-labelledby");
  if (labelledBy) {
    const labelId = labelledBy.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
    await page.locator(`[id="${labelId}"]`).click();
  } else {
    await item.getByText(value, { exact: true }).last().click();
  }
  let selected = false;
  for (let attempt = 0; attempt < 10 && !selected; attempt += 1) {
    selected = (await input.isChecked()) || (await input.getAttribute("aria-checked")) === "true";
    if (!selected) await page.waitForTimeout(50);
  }
  if (!selected) throw new Error(`Could not select ${questionText}: ${value}`);
}

export async function fillSickForm(page, form, dates, { submit = false, zone = "Europe/Amsterdam" } = {}) {
  await page.goto(form.url, { waitUntil: "domcontentloaded" });
  await question(page, "Studentnummer").waitFor({ state: "visible" });

  await fillText(page, "Studentnummer", form.studentNumber);
  await fillText(page, "Voornaam", form.firstName);
  await fillText(page, "Achternaam", form.lastName);
  await fillDate(page, "Geboortedatum", form.birthDate, zone);
  await choose(page, "Opleiding", form.programme);
  await choose(page, "Wie doet de aanvraag", form.applicant);
  await fillText(page, "Telefoonnummer van aanvrager", form.phoneNumber);
  await choose(page, "Telefonisch contact gewenst", form.wantsPhoneContact);
  await choose(page, "Reden afwezigheid", "Ziek");

  await question(page, "Welke dag meld je je ziek").waitFor({ state: "visible" });
  await fillDate(page, "Welke dag meld je je ziek", dates.startDate, zone);
  await fillDate(page, "Wanneer verwacht je beter te zijn", dates.lastSickDate, zone);

  if (submit) {
    await page.getByRole("button", { name: /^Submit$/i }).click();
    await page
      .getByText(/Your response was submitted|Bedankt|antwoord.*verzonden/i)
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
  }

  return { submitted: submit, ...dates };
}

export async function runFormAutomation(form, dates, options = {}) {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    return await fillSickForm(page, form, dates, options);
  } finally {
    await browser.close();
  }
}
