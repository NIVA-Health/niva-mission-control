import { NextResponse } from "next/server";
import { getUserEmail, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const email = getUserEmail(new Headers(req.headers));
  return NextResponse.json({ email, isAdmin: isAdmin(email) });
}
