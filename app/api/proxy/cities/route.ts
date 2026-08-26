import { forwardToManagementApp } from "@/lib/proxy";

/**
 * The signup form's city dropdown must be the platform's real City list
 * (user requirement: "list is the cities from our db"), not a hardcoded
 * Hebrew list baked into this repo — city names/spellings are the
 * management app's data, not ours to duplicate and let drift.
 */
export async function GET(request: Request) {
  return forwardToManagementApp(request, "/api/public/cities");
}
