import { afterAll, beforeAll } from "vitest";

// Silence pino logs during tests unless explicitly needed
process.env.LOG_LEVEL = "silent";

beforeAll(() => {
  // Global test setup
});

afterAll(() => {
  // Global test teardown
});
