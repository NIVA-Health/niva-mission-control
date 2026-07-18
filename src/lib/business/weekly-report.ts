import type { Project } from "@/domain/project";
import { computePortfolioSummary, recentlyCompleted, upcomingDueDates } from "./portfolio";
import { formatDate } from "@/lib/utils";

/**
 * Renders a Markdown weekly status report from the same data the dashboard
 * shows — meant for pasting into Slack/email or handing to people who don't
 * have (or want) a login to the live app.
 */
export function buildWeeklyReportMarkdown(projects: Project[], now = Date.now()): string {
  const summary = computePortfolioSummary(projects, now);
  const upcoming = upcomingDueDates(projects, now);
  const wins = recentlyCompleted(projects, now);

  const dateStr = new Date(now).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const lines: string[] = [];
  lines.push("# NIVA Mission Control — Weekly Status");
  lines.push(`_Generated ${dateStr}_`);
  lines.push("");

  lines.push("## Portfolio Summary");
  lines.push(`- Active projects: **${summary.activeProjects}**`);
  lines.push(`- On track: **${summary.onTrack}**`);
  lines.push(`- Not started: **${summary.notStarted}**`);
  lines.push(`- Blocked: **${summary.blocked}**`);
  lines.push(`- Completed this week: **${summary.completedThisWeek}**`);
  lines.push("");

  lines.push("## Upcoming Due Dates");
  if (upcoming.length === 0) {
    lines.push("Nothing due in the near term.");
  } else {
    for (const project of upcoming) {
      lines.push(`- **${project.name}** — ${formatDate(project.targetCompletion)} (${project.phase})`);
    }
  }
  lines.push("");

  if (wins.length > 0) {
    lines.push("## Completed This Week");
    for (const project of wins) {
      lines.push(`- ${project.name} — completed ${formatDate(project.lastUpdated)}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
