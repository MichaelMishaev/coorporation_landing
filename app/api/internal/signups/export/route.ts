import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

// Server-to-server endpoint — rate-limited by a fixed internal key rather
// than caller IP, reusing the same SignupRateLimitBucket upsert pattern as
// lib/signup/submit-signup.ts's per-minute window.
const INTERNAL_RATE_LIMIT_KEY = "signup-export";
const RATE_LIMIT_THRESHOLD = 5;

function currentWindowStart(): Date {
  const now = new Date();
  now.setSeconds(0, 0);
  return now;
}

function encodeCursor(createdAt: Date, id: string): string {
  return `${createdAt.toISOString()}_${id}`;
}

function decodeCursor(raw: string): { createdAt: Date; id: string } | null {
  const separatorIndex = raw.lastIndexOf("_");
  if (separatorIndex === -1) return null;
  const createdAt = new Date(raw.slice(0, separatorIndex));
  const id = raw.slice(separatorIndex + 1);
  if (Number.isNaN(createdAt.getTime()) || !id) return null;
  return { createdAt, id };
}

function jsonError(status: number): Response {
  return NextResponse.json({ error: "error" }, { status });
}

export async function GET(request: NextRequest): Promise<Response> {
  const secret = request.headers.get("x-signup-export-secret");
  if (!secret || secret !== process.env.SIGNUP_EXPORT_SECRET) {
    return jsonError(401);
  }

  const windowStart = currentWindowStart();
  const bucket = await prisma.signupRateLimitBucket.upsert({
    where: { ip_windowStart: { ip: INTERNAL_RATE_LIMIT_KEY, windowStart } },
    create: { ip: INTERNAL_RATE_LIMIT_KEY, windowStart, count: 1 },
    update: { count: { increment: 1 } },
  });
  if (bucket.count > RATE_LIMIT_THRESHOLD) {
    return jsonError(429);
  }

  const { searchParams } = new URL(request.url);
  const cursorParam = searchParams.get("cursor");
  const limitParam = searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limitParam) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  const cursor = cursorParam ? decodeCursor(cursorParam) : null;
  if (cursorParam && !cursor) {
    return jsonError(400);
  }

  const rows = await prisma.supportSignup.findMany({
    where: {
      honeypotTripped: false,
      ...(cursor
        ? {
            OR: [
              { createdAt: { gt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { gt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit,
    select: {
      id: true,
      fullName: true,
      phone: true,
      cityName: true,
      referralCode: true,
      createdAt: true,
    },
  });

  const nextCursor =
    rows.length === limit ? encodeCursor(rows[rows.length - 1].createdAt, rows[rows.length - 1].id) : null;

  return NextResponse.json({ signups: rows, nextCursor });
}
