import { NextResponse } from "next/server";
import { getUserEmail, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const email = getUserEmail(new Headers(req.headers));
  // Surfaced from the server (not NEXT_PUBLIC_) so the default view can be
  // switched with `gcloud run services update` — no rebuild required.
  const defaultView = process.env.DEFAULT_VIEW === "programs" ? "programs" : "delivery";
  return NextResponse.json({ email, isAdmin: isAdmin(email), defaultView });
}
