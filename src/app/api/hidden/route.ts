import { NextResponse } from "next/server";
import { getUserEmail, isAdmin } from "@/lib/auth";
import { hideCard, listHidden, restoreCard } from "@/lib/hidden-store";

export const dynamic = "force-dynamic";

/** Anyone who can see the dashboard can read the hidden list. */
export async function GET() {
  const hidden = await listHidden();
  return NextResponse.json({ hidden });
}

/** Hiding affects every viewer, so it is restricted to configured admins. */
export async function POST(req: Request) {
  const email = getUserEmail(new Headers(req.headers));
  if (!isAdmin(email)) {
    return NextResponse.json({ error: "Not permitted to hide cards." }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as { id?: string; name?: string } | null;
  if (!body?.id) {
    return NextResponse.json({ error: "Missing card id." }, { status: 400 });
  }
  try {
    const entry = await hideCard({ id: body.id, name: body.name ?? body.id }, email!);
    return NextResponse.json({ hidden: entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to hide card.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const email = getUserEmail(new Headers(req.headers));
  if (!isAdmin(email)) {
    return NextResponse.json({ error: "Not permitted to restore cards." }, { status: 403 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing card id." }, { status: 400 });
  try {
    await restoreCard(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to restore card.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
