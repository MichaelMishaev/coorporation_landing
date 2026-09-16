import { SignupForm } from "./SignupForm";
import { prisma } from "@/lib/prisma";
import { CITIES } from "@/lib/cities";

export const metadata = { title: "מצטרפים | עמך ישראל" };

/**
 * Resolves a `ref` query param to a city prefill entirely from the local
 * mirror — never a runtime call back to corporations. Degrades safely by
 * construction: a missing/unknown/inactive code, or a mirrored city name
 * that isn't in the current static CITIES list, all fall through to
 * `undefined`, which is exactly today's no-prefill behavior. See
 * docs/superpowers/specs/2026-09-01-referral-signup-links-design.md
 * (corporations repo) Component 2.
 */
export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  let prefillCity: string | undefined;
  let activeReferralCode: string | undefined;
  if (ref) {
    const mirrored = await prisma.referralLinkMirror.findUnique({ where: { code: ref } });
    if (mirrored?.active) {
      activeReferralCode = ref;
      if (mirrored.cityName && (CITIES as readonly string[]).includes(mirrored.cityName)) {
        prefillCity = mirrored.cityName;
      }
    }
  }

  // Only a currently active mirrored code may create new attribution. A
  // revoked or unknown URL still offers the general signup form, but it no
  // longer assigns the signup to its former owner.
  return <SignupForm prefillCity={prefillCity} referralCode={activeReferralCode} />;
}
