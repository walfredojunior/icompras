import { Queue } from "bullmq";
import IORedis from "ioredis";
import type { PriceListItem } from "@icompras/core";

export const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

// Conexão compartilhada (maxRetriesPerRequest: null é exigência do BullMQ).
export const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

export const PRICE_LIST_QUEUE = "price-list";

export interface PriceListJob {
  storeId: number;
  items: PriceListItem[];
  source?: "api" | "scraped";
}

export const priceListQueue = new Queue<PriceListJob>(PRICE_LIST_QUEUE, { connection });
