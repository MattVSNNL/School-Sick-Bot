const asBoolean = (value, fallback) =>
  value == null ? fallback : value.toLowerCase() === "true";

export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT ?? 3000),
    zone: env.TIME_ZONE ?? "Europe/Amsterdam",
    earliestToday: env.EARLIEST_TODAY ?? "06:00",
    todayCutoff: env.TODAY_CUTOFF ?? "09:30",
    skipWeekends: asBoolean(env.SKIP_WEEKENDS, true),
    apiKey: env.SICK_API_KEY ?? "",
    submitEnabled: asBoolean(env.SUBMIT_ENABLED, false),
    dataFile: env.DATA_FILE ?? ".data/jobs.json",
    notifications: {
      discordWebhookUrl: env.DISCORD_WEBHOOK_URL ?? "",
    },
    form: {
      url: env.FORM_URL ?? "",
      studentNumber: env.STUDENT_NUMBER ?? "",
      firstName: env.FIRST_NAME ?? "",
      lastName: env.LAST_NAME ?? "",
      birthDate: env.BIRTH_DATE ?? "",
      programme: env.PROGRAMME ?? "Software Developer niveau 4",
      applicant: env.APPLICANT ?? "Student",
      phoneNumber: env.PHONE_NUMBER ?? "",
      wantsPhoneContact: env.WANTS_PHONE_CONTACT ?? "Nee",
    },
  };
}

export function validateConfig(config, { forSubmission = false } = {}) {
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error("PORT must be a valid port number");
  }
  if (config.apiKey.length < 32) {
    throw new Error("SICK_API_KEY must contain at least 32 characters");
  }
  if (forSubmission) {
    const missing = Object.entries(config.form)
      .filter(([, value]) => !value)
      .map(([key]) => key);
    if (missing.length) throw new Error(`Missing form settings: ${missing.join(", ")}`);
  }
}
