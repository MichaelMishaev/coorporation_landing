import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { submitSignup, type SubmitSignupInput } from "@/lib/signup/submit-signup";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const MAX_NAME_LENGTH = 200;
const MAX_PHONE_LENGTH = 30;
const MAX_CITY_LENGTH = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonError(status: number): Response {
  return Response.json({ status: "error" }, { status });
}

/**
 * Client IP trust model — per
 * docs/features/standalone-signup/spec.md "Client IP trust model": for a
 * single reverse-proxy hop (Railway's edge, directly in front of this
 * app), the rightmost X-Forwarded-For entry is the one the edge itself
 * appended — a client-supplied value is always prepended before that.
 * No other header is trusted (in particular, no X-Real-Ip fallback — an
 * unverified header a client may be able to set directly). Fails closed
 * (returns null) rather than falling back to a shared "unknown" bucket
 * if no trustworthy IP can be determined.
 */
function getClientIp(request: Request): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }
  }
  return null;
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400);
  }

  if (typeof body !== "object" || body === null) {
    return jsonError(400);
  }

  const { fullName, phone, cityName, clientSubmissionId, website } = body as Record<string, unknown>;

  if (typeof fullName !== "string" || typeof phone !== "string" || typeof clientSubmissionId !== "string") {
    return jsonError(400);
  }

  const trimmedName = fullName.trim();
  if (!trimmedName || trimmedName.length > MAX_NAME_LENGTH) {
    return jsonError(400);
  }

  const trimmedPhone = phone.trim();
  if (!trimmedPhone || trimmedPhone.length > MAX_PHONE_LENGTH) {
    return jsonError(400);
  }

  let normalizedCity: string | null = null;
  if (typeof cityName === "string") {
    const trimmedCity = cityName.trim();
    if (trimmedCity.length > MAX_CITY_LENGTH) {
      return jsonError(400);
    }
    normalizedCity = trimmedCity || null;
  }

  if (!UUID_PATTERN.test(clientSubmissionId)) {
    return jsonError(400);
  }

  const ip = getClientIp(request);
  if (!ip) {
    return jsonError(400);
  }

  const honeypotTripped = typeof website === "string" && website.trim().length > 0;

  const input: SubmitSignupInput = {
    fullName: trimmedName,
    phone: trimmedPhone,
    cityName: normalizedCity,
    clientSubmissionId,
    ip,
    honeypotTripped,
  };

  const result = await submitSignup(prisma, input);

  switch (result.type) {
    case "success":
      return Response.json({ status: "success" });
    case "conflict":
      return Response.json({ status: "conflict" }, { status: 409 });
    case "rateLimited":
      return jsonError(429);
  }
}
