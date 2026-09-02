import { prisma } from "@/lib/prisma";

interface MirrorLinkPayload {
  code: string;
  active: boolean;
  cityName: string | null;
}

function jsonError(status: number): Response {
  return Response.json({ status: "error" }, { status });
}

function isValidLinksPayload(body: unknown): body is { links: MirrorLinkPayload[] } {
  if (typeof body !== "object" || body === null) return false;
  const { links } = body as Record<string, unknown>;
  if (!Array.isArray(links)) return false;
  return links.every(
    (link) =>
      typeof link === "object" &&
      link !== null &&
      typeof (link as Record<string, unknown>).code === "string" &&
      typeof (link as Record<string, unknown>).active === "boolean" &&
      ((link as Record<string, unknown>).cityName === null ||
        typeof (link as Record<string, unknown>).cityName === "string")
  );
}

/**
 * Full-list-replace, not a diff/patch — every call represents corporations'
 * CURRENT complete set of active referral-link codes. Upserts every code
 * present; deactivates (never deletes) every mirrored code NOT present, so
 * a missed individual push self-heals on the next periodic full-list push.
 * See docs/superpowers/specs/2026-09-01-referral-signup-links-design.md
 * (corporations repo) Component 2.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = request.headers.get("x-referral-link-sync-secret");
  if (!secret || secret !== process.env.REFERRAL_LINK_SYNC_SECRET) {
    return jsonError(401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400);
  }

  if (!isValidLinksPayload(body)) {
    return jsonError(400);
  }

  const { links } = body;
  const incomingCodes = links.map((link) => link.code);

  await prisma.$transaction(async (tx) => {
    for (const link of links) {
      await tx.referralLinkMirror.upsert({
        where: { code: link.code },
        create: { code: link.code, active: link.active, cityName: link.cityName },
        update: { active: link.active, cityName: link.cityName },
      });
    }
    await tx.referralLinkMirror.updateMany({
      where: { code: { notIn: incomingCodes.length > 0 ? incomingCodes : ["__none__"] } },
      data: { active: false },
    });
  });

  return Response.json({ status: "success" });
}
