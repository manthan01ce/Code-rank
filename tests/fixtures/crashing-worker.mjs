// Trusted integration fixture. The parent kills this process after activation.
import { Worker } from "bullmq";

const worker = new Worker(
  process.argv[2],
  async (job) => {
    process.send({ type: "active", jobId: job.id });
    await new Promise(() => {});
  },
  {
    connection: {
      host: "127.0.0.1",
      port: Number(process.argv[3]),
      maxRetriesPerRequest: null,
    },
    lockDuration: 500,
    stalledInterval: 100,
    maxStalledCount: 1,
  },
);
worker.on("error", (error) =>
  process.send?.({ type: "error", message: error.message }),
);
