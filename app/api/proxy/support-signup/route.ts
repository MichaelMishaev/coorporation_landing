import { forwardToManagementApp } from "@/lib/proxy";

export async function POST(request: Request) {
  return forwardToManagementApp(request, "/api/public/support-signup");
}
