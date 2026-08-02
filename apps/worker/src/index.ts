import "./env.js";
import { Worker } from "bullmq";
import { connection, PRICE_LIST_QUEUE } from "@icompras/queue";
import { processPriceList } from "./ingest.js";

const worker = new Worker(PRICE_LIST_QUEUE, async (job) => processPriceList(job.data), {
  connection,
  concurrency: 4,
});

worker.on("completed", (job, result) => {
  console.log(`[job ${job.id}] concluído:`, result);
});
worker.on("failed", (job, err) => {
  console.error(`[job ${job?.id}] falhou:`, err?.message);
});

console.log("Worker de ingestão iniciado. Aguardando jobs na fila...");
