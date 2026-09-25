import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export class JobStore {
  constructor(file) {
    this.file = path.resolve(file);
    this.jobs = [];
    this.pending = Promise.resolve();
  }

  async init() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    try {
      this.jobs = JSON.parse(await fs.readFile(this.file, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await this.save();
    }
  }

  async save() {
    const temporary = `${this.file}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(this.jobs, null, 2));
    await fs.rename(temporary, this.file);
  }

  exclusive(task) {
    const result = this.pending.then(task, task);
    this.pending = result.catch(() => {});
    return result;
  }

  async create(job) {
    return this.exclusive(async () => {
      const duplicate = this.jobs.find(
        (item) =>
          item.startDate === job.startDate &&
          ["scheduled", "running", "submitted"].includes(item.status),
      );
      if (duplicate) return { created: false, job: duplicate };

      const record = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        ...job,
      };
      this.jobs.push(record);
      await this.save();
      return { created: true, job: record };
    });
  }

  async update(id, changes) {
    return this.exclusive(async () => {
      const job = this.jobs.find((item) => item.id === id);
      if (!job) throw new Error(`Unknown job: ${id}`);
      Object.assign(job, changes, { updatedAt: new Date().toISOString() });
      await this.save();
      return job;
    });
  }

  scheduled() {
    return this.jobs.filter((job) => job.status === "scheduled");
  }
}
