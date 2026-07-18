import type { PortfolioSummary, Project } from "@/domain/project";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** "On track": actively progressing and not blocked or overdue. */
export function isOnTrack(p: Project, now = Date.now()): boolean {
  if (p.status === "Blocked") return false;
  if (p.status === "Completed") return false;
  if (isPastDue(p, now)) return false;
  return true;
}

export function isPastDue(p: Project, now = Date.now()): boolean {
  if (p.status === "Completed" || !p.targetCompletion) return false;
  return new Date(p.targetCompletion).getTime() < now;
}

export function isActive(p: Project): boolean {
  return p.status !== "Completed";
}

export function computePortfolioSummary(projects: Project[], now = Date.now()): PortfolioSummary {
  return {
    activeProjects: projects.filter(isActive).length,
    onTrack: projects.filter((p) => isOnTrack(p, now)).length,
    notStarted: projects.filter((p) => p.status === "Not Started").length,
    blocked: projects.filter((p) => p.status === "Blocked").length,
    completedThisWeek: projects.filter(
      (p) => p.status === "Completed" && now - new Date(p.lastUpdated).getTime() <= ONE_WEEK_MS,
    ).length,
  };
}

/** Projects completed in the last 7 days, most recent first — used for wins/report roll-ups. */
export function recentlyCompleted(projects: Project[], now = Date.now()): Project[] {
  return projects
    .filter((p) => p.status === "Completed" && now - new Date(p.lastUpdated).getTime() <= ONE_WEEK_MS)
    .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
}

/**
 * Active projects with a target date from `now` forward, soonest first. Past-due
 * projects are excluded here (that's visible per-card via the due-date coloring
 * on the project grid) — this list stays focused on "what's coming."
 */
export function upcomingDueDates(projects: Project[], now = Date.now(), limit = 8): Project[] {
  return projects
    .filter((p) => p.status !== "Completed" && p.targetCompletion)
    .filter((p) => new Date(p.targetCompletion as string).getTime() >= now)
    .sort((a, b) => new Date(a.targetCompletion as string).getTime() - new Date(b.targetCompletion as string).getTime())
    .slice(0, limit);
}
