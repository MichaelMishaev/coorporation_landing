/**
 * Same-origin proxy to the management app's /api/public/* routes.
 * See docs/features/leadMachine/2026-08-26-supporter-self-signup-design.md
 * ("Same-origin proxy") in the corporations repo for the full contract.
 *
 * This file has no business logic — it forwards the request and the real
 * client IP, nothing else. Validation, dedup, and RBAC all live in the
 * management app.
 */

const MANAGEMENT_APP_BASE_URL = process.env.MANAGEMENT_APP_BASE_URL;
const PUBLIC_PROXY_SECRET = process.env.PUBLIC_PROXY_SECRET;

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export async function forwardToManagementApp(
  request: Request,
  path: string,
): Promise<Response> {
  if (!MANAGEMENT_APP_BASE_URL || !PUBLIC_PROXY_SECRET) {
    // Missing config is a deploy/env problem, not a client error — but we
    // still return a generic failure, not a stack trace or config detail.
    return Response.json({ status: "error" }, { status: 502 });
  }

  const body = request.method === "GET" ? undefined : await request.text();

  const upstream = await fetch(`${MANAGEMENT_APP_BASE_URL}${path}`, {
    method: request.method,
    headers: {
      "Content-Type": "application/json",
      "X-Public-Proxy-Secret": PUBLIC_PROXY_SECRET,
      "X-Original-Client-IP": getClientIp(request),
    },
    body,
    // The management app is the source of truth; never cache a signup call.
    cache: "no-store",
  });

  const responseBody = await upstream.text();
  return new Response(responseBody, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
