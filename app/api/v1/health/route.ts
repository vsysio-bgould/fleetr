import { NextResponse } from "next/server";
import db from "@/lib/db";
import redis from "@/lib/redis";

export async function GET() {
  const checks = await Promise.allSettled([
    db.$queryRaw`SELECT 1`,
    redis.ping(),
  ]);

  const [dbCheck, redisCheck] = checks;

  const status = {
    db: dbCheck.status === "fulfilled" ? "ok" : "error",
    redis: redisCheck.status === "fulfilled" ? "ok" : "error",
  };

  const healthy = status.db === "ok" && status.redis === "ok";

  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks: status },
    { status: healthy ? 200 : 503 }
  );
}
