import { SignupForm } from "../SignupForm";

export const metadata = { title: "מצטרפים | עמך ישראל" };

/** Personal recruiter link / QR entry — spec §4. */
export default async function PersonalJoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <SignupForm linkCode={code} />;
}
