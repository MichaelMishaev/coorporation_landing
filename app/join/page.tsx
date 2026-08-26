import { SignupForm } from "./SignupForm";

export const metadata = { title: "מצטרפים | עמך ישראל" };

/**
 * Generic link entry — spec §4. Renders the form directly (no redirect to
 * /join/{code}) using the generic code read from a public env var.
 */
export default function GenericJoinPage() {
  const genericCode = process.env.NEXT_PUBLIC_GENERIC_JOIN_CODE ?? "";

  if (!genericCode) {
    return <p style={{ padding: 64, textAlign: "center" }}>הקישור אינו פעיל</p>;
  }

  return <SignupForm linkCode={genericCode} />;
}
