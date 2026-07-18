"use client";

import Link from "next/link";
import { CalendarClock } from "lucide-react";
import type { Project } from "@/domain/project";
import { upcomingDueDates } from "@/lib/business/portfolio";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, dueLabel, formatDate } from "@/lib/utils";

export function UpcomingDueDates({ projects }: { projects: Project[] }) {
  const items = upcomingDueDates(projects);

  return (
    <section aria-label="Upcoming due dates" className="space-y-3">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Upcoming Due Dates</h2>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>

      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <div className="p-5">
            <EmptyState title="Nothing on the horizon" message="No active projects have an upcoming target date." />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((project) => {
              const due = dueLabel(project.targetCompletion);
              const urgent = due.startsWith("Due in") && Number(due.replace(/\D+/g, "")) <= 7;
              return (
                <li key={project.id}>
                  <Link
                    href={`/project/${project.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-elevated"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{project.name}</div>
                      <div className="text-[11px] text-muted-foreground">{project.phase}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={cn("text-xs font-semibold", urgent ? "text-status-gold" : "text-foreground")}>
                        {due}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{formatDate(project.targetCompletion)}</div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </section>
  );
}
