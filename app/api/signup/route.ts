import { submitSignup, type SubmitSignupInput, type SubmitSignupResult } from "@/lib/signup/submit-signup";
import { prisma } from "@/lib/prisma";

const MAX_NAME_LENGTH = 200;
const MAX_CITY_LENGTH = 100;
const MAX_BODY_BYTES = 4096;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
// Israeli mobile numbers: "05" + 8 more digits, 10 digits total. Matches
// the client's PHONE_PATTERN in SignupForm.tsx — the client only ever
// sends raw digits (no dashes), so this is the same check applied
// server-side, since a request bypassing the UI must not be trusted to
// have sent a valid shape.
const PHONE_PATTERN = /^05\d{8}$/;

function jsonError(status: number): Response {
  return Response.json({ status: "error" }, { status });
}

/**
 * Loose but real shape validation — rejects garbage before it's trusted
 * as an identity for rate-limiting and stored for abuse review. Not a
 * full RFC-compliant IPv4/IPv6 parser, just enough to reject non-IP
 * strings a malformed or hostile header could otherwise smuggle through.
 */
function isPlausibleClientIp(candidate: string): boolean {
  const v4Match = candidate.match(IPV4_PATTERN);
  if (v4Match) {
    return v4Match.slice(1).every((octet) => Number(octet) <= 255);
  }
  return (
    candidate.length <= 45 &&
    candidate.includes(":") &&
    /^[0-9a-fA-F:]+$/.test(candidate) &&
    /[0-9a-fA-F]/.test(candidate.replace(/:/g, ""))
  );
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
 * if no trustworthy IP can be determined — including when the rightmost
 * entry doesn't look like a real IP address at all.
 */
function getClientIp(request: Request): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      const candidate = parts[parts.length - 1];
      return isPlausibleClientIp(candidate) ? candidate : null;
    }
  }
  return null;
}

export async function POST(request: Request): Promise<Response> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return jsonError(413);
  }

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
  if (!PHONE_PATTERN.test(trimmedPhone)) {
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

  let result: SubmitSignupResult;
  try {
    result = await submitSignup(prisma, input);
  } catch (err) {
    console.error("submitSignup failed", err);
    return jsonError(500);
  }

  switch (result.type) {
    case "success":
      return Response.json({ status: "success" });
    case "conflict":
      return Response.json({ status: "conflict" }, { status: 409 });
    case "rateLimited":
      return jsonError(429);
  }
}
