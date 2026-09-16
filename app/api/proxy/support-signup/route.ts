import { forwardToManagementApp } from "@/lib/proxy";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ status: "error" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return Response.json({ status: "error" }, { status: 400 });
  }

  const { privacyAccepted, ...upstreamBody } = body as Record<string, unknown>;
  if (privacyAccepted !== true) {
    return Response.json({ status: "error" }, { status: 400 });
  }

  const headers = new Headers(request.headers);
  headers.set("Content-Type", "application/json");
  headers.set("X-Privacy-Consent", "accepted");
  headers.set("X-Privacy-Policy-Version", "amchaisrael-privacy-v1");
  headers.delete("Content-Length");

  const upstreamRequest = new Request(request.url, {
    method: "POST",
    headers,
    body: JSON.stringify(upstreamBody),
  });

  return forwardToManagementApp(upstreamRequest, "/api/public/support-signup");
}
