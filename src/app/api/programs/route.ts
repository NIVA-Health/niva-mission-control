import { NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const view = await getRepository().getPrograms();
    return NextResponse.json(view);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load programmes.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
