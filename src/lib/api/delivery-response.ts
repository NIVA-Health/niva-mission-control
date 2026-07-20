import type { Owner, PortfolioSummary, Project, ProjectChild } from "@/domain/project";

export type DeliveryProgressMethod = "checklist" | "stage_estimate";

export interface DeliveryApiOwner {
  id: string;
  name: string;
  initials: string;
}

export interface DeliveryApiChild {
  id: string;
  name: string;
  phase: ProjectChild["phase"];
  status: ProjectChild["status"];
  owners: DeliveryApiOwner[];
}

export interface DeliveryApiActivity {
  id: string;
  text: string;
  at: string;
}

export interface DeliveryApiProject {
  id: string;
  name: string;
  status: Project["status"];
  priority: Project["priority"];
  phase: Project["phase"];
  progress: number;
  progressMethod: DeliveryProgressMethod;
  checklistDone: number;
  checklistTotal: number;
  owners: DeliveryApiOwner[];
  targetCompletion: string | null;
  lastUpdated: string;
  completedAt: string | null;
  description: string | null;
  source: Project["source"];
  programName: string | null;
  children: DeliveryApiChild[];
  recentActivity: DeliveryApiActivity[];
}

export interface DeliveryApiResponse {
  schemaVersion: "1.0";
  generatedAt: string;
  source: "mission-control";
  view: "delivery";
  summary: PortfolioSummary;
  projects: DeliveryApiProject[];
}

function mapOwner(owner: Owner): DeliveryApiOwner {
  return {
    id: owner.id,
    name: owner.name,
    initials: owner.initials,
  };
}

function mapChild(child: ProjectChild): DeliveryApiChild {
  return {
    id: child.id,
    name: child.name,
    phase: child.phase,
    status: child.status,
    owners: child.owners.map(mapOwner),
  };
}

export function progressMethodFor(project: Project): DeliveryProgressMethod {
  return project.checklistTotal > 0 ? "checklist" : "stage_estimate";
}

/** Explicit whitelist projection — never serialize adapter/raw Trello fields. */
export function toDeliveryApiProject(project: Project): DeliveryApiProject {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    priority: project.priority,
    phase: project.phase,
    progress: project.progress,
    progressMethod: progressMethodFor(project),
    checklistDone: project.checklistDone,
    checklistTotal: project.checklistTotal,
    owners: project.owners.map(mapOwner),
    targetCompletion: project.targetCompletion,
    lastUpdated: project.lastUpdated,
    completedAt: project.completedAt,
    description: project.description,
    source: project.source,
    programName: project.programName,
    children: project.children.map(mapChild),
    recentActivity: project.recentActivity.map((a) => ({
      id: a.id,
      text: a.text,
      at: a.at,
    })),
  };
}

export function buildDeliveryResponse(
  projects: Project[],
  summary: PortfolioSummary,
  generatedAt = new Date().toISOString(),
): DeliveryApiResponse {
  return {
    schemaVersion: "1.0",
    generatedAt,
    source: "mission-control",
    view: "delivery",
    summary,
    projects: projects.map(toDeliveryApiProject),
  };
}
