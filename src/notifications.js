const MAX_ERROR_LENGTH = 1000;

function shorten(value) {
  const text = String(value ?? "Unknown error").replaceAll("`", "'");
  return text.length <= MAX_ERROR_LENGTH ? text : `${text.slice(0, MAX_ERROR_LENGTH)}...`;
}

export function createDiscordNotifier({ webhookUrl, fetchImpl = fetch, logger = console }) {
  async function send(content) {
    if (!webhookUrl) return { sent: false, reason: "disabled" };

    try {
      const response = await fetchImpl(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "School Sick Bot",
          content,
          allowed_mentions: { parse: [] },
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        throw new Error(`Discord returned HTTP ${response.status}`);
      }
      return { sent: true };
    } catch (error) {
      logger.error(`Discord notification failed: ${error.message}`);
      return { sent: false, error: error.message };
    }
  }

  return {
    submissionSucceeded({ startDate, lastSickDate }) {
      return send(
        `✅ **Ziekmelding verzonden**\nBegindatum: ${startDate}\nLaatste ziektedag: ${lastSickDate}`,
      );
    },
    submissionFailed({ startDate, lastSickDate, error }) {
      return send(
        `❌ **Ziekmelding mislukt**\nBegindatum: ${startDate}\nLaatste ziektedag: ${lastSickDate}\nFout: \`${shorten(error?.message ?? error)}\``,
      );
    },
  };
}
