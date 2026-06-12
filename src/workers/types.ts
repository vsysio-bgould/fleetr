import type { Job } from "bullmq";

export interface WorkerDefinition<TPayload = unknown> {
  queueName: string;
  concurrency?: number;
  process(job: Job<TPayload>): Promise<void>;
}
