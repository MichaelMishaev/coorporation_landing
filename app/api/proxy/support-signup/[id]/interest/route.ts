import { forwardToManagementApp } from "@/lib/proxy";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return forwardToManagementApp(
    request,
    `/api/public/support-signup/${id}/interest`,
  );
}
