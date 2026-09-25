# Sick form bot

A small private server for an iPhone Shortcut. It calculates the correct start date, fills the MBO College Almere Microsoft Form with Playwright, and submits only after an explicit `confirm: true` request.

## Date rules

- Before 06:00: queue today's report and send it at 06:00.
- 06:00 through 09:29: submit for today immediately.
- 09:30 or later: submit immediately with the next day as the start date.
- With `SKIP_WEEKENDS=true`, a Friday-evening report starts on Monday.
- Question 11 is the final day absent, not the return date.

The pre-06:00 queue is saved to `DATA_FILE`. On Railway, attach a volume at `/data` and set `DATA_FILE=/data/jobs.json` so it survives restarts.

## Run locally

1. Copy `.env.example` to `.env` and fill in the private values.
2. Load the environment variables in your preferred way.
3. Install and test:

```text
npm install
npx playwright install chromium
npm test
npm start
```

Keep `SUBMIT_ENABLED=false` at first. Test the completely local replica:

```text
POST http://localhost:3000/dry-run
Authorization: Bearer YOUR_LONG_SECRET
Content-Type: application/json

{"lastSickDate":"2026-09-25"}
```

Nothing is sent to Microsoft during `/dry-run`.

To inspect the local visual replica in a browser, open:

```text
http://localhost:3000/test-form?demo=1
```

Replace `localhost` with the PC's local IP address to open it from an iPhone on the same Wi-Fi. The page is marked as a local test and its Submit button never transmits data.

## Railway

1. Put these files in a private GitHub repository.
2. Create a Railway service from that repository. Railway will use the `Dockerfile`.
3. Add all variables from `.env.example` in Railway's Variables screen.
4. Add a volume mounted at `/data`, then use `DATA_FILE=/data/jobs.json`.
5. Generate a public HTTPS domain.
6. Call `/health`, then `/dry-run`.
7. Only after the dry run passes, set `SUBMIT_ENABLED=true`.

The server intentionally refuses live requests while `SUBMIT_ENABLED=false`.

### Discord notifications

To receive a message after every successful or failed form submission, create a
Discord channel webhook and add its complete private URL as a Railway variable:

```text
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

Redeploy after adding it. This also covers a queued 06:00 submission because the
notification is sent by the server after the browser finishes. A notification
problem is logged but never changes the result of the form submission. Keep the
webhook URL private; anyone who has it can post to that Discord channel.

## iPhone Shortcut

Create a Shortcut named `Ziekmelden`:

1. Ask for Date: `Tot en met welke dag verwacht je ziek te zijn?`
2. Format Date as `yyyy-MM-dd`.
3. Show a confirmation alert.
4. Get Contents of URL:
   - URL: `https://YOUR-RAILWAY-DOMAIN/sick`
   - Method: `POST`
   - Header: `Authorization` = `Bearer YOUR_LONG_SECRET`
   - Request Body: JSON
   - `lastSickDate`: the formatted date
   - `confirm`: `true`
5. Show the returned result.

For a one-day illness, you may omit `lastSickDate`; the server uses the calculated start date.

## API

- `GET /health`: public health check.
- `GET /test-form?demo=1`: visible, interactive local replica with dummy data.
- `POST /preview`: calculate the dates without opening a browser.
- `POST /dry-run`: fill the bundled local replica without submitting.
- `POST /sick`: submit now or durably queue for 06:00. Requires `confirm: true` and `SUBMIT_ENABLED=true`.

Every endpoint except `/health` requires `Authorization: Bearer ...`. Duplicate reports for the same start date are rejected by returning the existing job instead of submitting again.

## Privacy notes

- Personal details stay in Railway environment variables, not in GitHub or the Shortcut.
- The API key is compared in constant time.
- Request bodies and personal values are not logged.
- The local dry run never opens the school form.
