import { Queue } from "bullmq";

// BullMQ bundles its own ioredis. Passing the shared Redis instance causes a
// type conflict between the two ioredis versions. Pass the URL string instead
// so BullMQ creates its own connection with compatible types.
const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };

export const queueAdvanceQueue = new Queue("queue-advance", {
  connection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 100,
  },
});

export const fleetCleanupQueue = new Queue("fleet-cleanup", {
  connection,
  defaultJobOptions: { removeOnComplete: true, removeOnFail: 10 },
});

export const sessionCleanupQueue = new Queue("session-cleanup", {
  connection,
  defaultJobOptions: { removeOnComplete: true, removeOnFail: 10 },
});

export const esiTokenRefreshQueue = new Queue("esi-token-refresh", {
  connection,
  defaultJobOptions: { removeOnComplete: true, removeOnFail: 10 },
});

export const locationSyncQueue = new Queue("location-sync", {
  connection,
  defaultJobOptions: { removeOnComplete: true, removeOnFail: 10 },
});

export const fcPresenceQueue = new Queue("fc-presence", {
  connection,
  defaultJobOptions: { removeOnComplete: true, removeOnFail: 10 },
});
