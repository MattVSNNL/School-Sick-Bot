import { createApp } from "./app.js";
import { loadConfig, validateConfig } from "./config.js";
import { JobStore } from "./job-store.js";
import { createSubmissionService } from "./service.js";

const config = loadConfig();
validateConfig(config);

const store = new JobStore(config.dataFile);
await store.init();
const submissionService = createSubmissionService({ config, store });
submissionService.resume();

const app = createApp({ config, submissionService });
app.listen(config.port, "0.0.0.0", () => {
  console.log(`Sick form server listening on port ${config.port}`);
});
