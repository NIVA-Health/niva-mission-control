import { NextResponse } from "next/server";
import {
  authenticateBearer,
  misconfiguredResponse,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { buildDeliveryResponse } from "@/lib/api/delivery-response";
import { computePortfolioSummary } from "@/lib/business/portfolio";
import { getRepository } from "@/lib/repository";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET(request: Request) {
  const auth = authenticateBearer(request);
  if (!auth.ok) {
    if (auth.reason === "misconfigured") {
      console.error("[api/v1/delivery] MISSION_CONTROL_API_TOKEN is not configured");
      return misconfiguredResponse();
    }
    return unauthorizedResponse();
  }

  try {
    const projects = await getRepository().getProjects();
    const summary = computePortfolioSummary(projects);
    const body = buildDeliveryResponse(projects, summary);
    return NextResponse.json(body, { headers: NO_STORE });
  } catch (err) {
    const name = err instanceof Error ? err.name : "Error";
    console.error("[api/v1/delivery] upstream failure", { name, path: "/api/v1/delivery" });
    return NextResponse.json(
      { error: "Bad gateway" },
      { status: 502, headers: NO_STORE },
    );
  }
}
