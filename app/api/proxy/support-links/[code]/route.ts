import { forwardToManagementApp } from "@/lib/proxy";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  return forwardToManagementApp(request, `/api/public/support-links/${code}`);
}
