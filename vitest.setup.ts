import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

// DB-backed tests delete their fixtures. Never let a missing override target
// a developer's Railway connection from .env.local.
const testDatabase = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
if (!testDatabase || !["localhost", "127.0.0.1", "::1"].includes(testDatabase.hostname)
  || !/(test|locality)/i.test(testDatabase.pathname)) {
  throw new Error("Tests require an explicit loopback DATABASE_URL with a disposable test database name.");
}

import "@testing-library/jest-dom/vitest";
