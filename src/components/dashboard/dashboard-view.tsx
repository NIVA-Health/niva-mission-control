"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LayoutGrid, Eye, EyeOff } from "lucide-react";
import { useProjects } from "@/lib/hooks/use-projects";
import { useHiddenCards, useHideCard, useRestoreCard, useViewer } from "@/lib/hooks/use-hidden";
import { filterProjects } from "@/lib/business/filter";
import { PortfolioSummary, type PortfolioFilterKey } from "./portfolio-summary";
import { UpcomingDueDates } from "./upcoming-due-dates";
import { ReportActions } from "./report-actions";
import { ProgramsView } from "./programs-view";
import { ViewSwitcher, type DashboardViewMode } from "./view-switcher";
import { ProjectGrid } from "./project-grid";
import { FilterPanel, EMPTY_FILTERS, type Filters } from "./filter-panel";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";

export function DashboardView() {
  const { data: projects, isLoading, isError, error, refetch } = useProjects();
  const params = useSearchParams();
  const query = params.get("q") ?? "";


  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [portfolioKey, setPortfolioKey] = useState<PortfolioFilterKey | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showHiddenPanel, setShowHiddenPanel] = useState(false);

  // Hiding is shared across all viewers (Firestore-backed) and restricted to
  // configured admins, so one person curating the board curates it for everyone.
  const { data: viewer } = useViewer();
  const { data: hiddenEntries } = useHiddenCards();
  const hideMutation = useHideCard();
  const restoreMutation = useRestoreCard();
  const canCurate = viewer?.isAdmin ?? false;

  // ?view= wins; otherwise fall back to the server-configured default so the
  // landing view can be switched without a rebuild.
  const requestedView = params.get("view");
  const view: DashboardViewMode =
    requestedView === "programs" || requestedView === "delivery"
      ? requestedView
      : (viewer?.defaultView ?? "delivery");

  const hidden = useMemo(() => hiddenEntries ?? [], [hiddenEntries]);
  const hiddenIds = useMemo(() => new Set(hidden.map((h) => h.id)), [hidden]);

  const owners = useMemo(() => {
    const map = new Map<string, string>();
    (projects ?? []).forEach((p) => p.owners.forEach((o) => map.set(o.id, o.name)));
    return Array.from(map, ([value, label]) => ({ value, label }));
  }, [projects]);

  const visible = useMemo(
    () => filterProjects(projects ?? [], { query, filters, portfolioKey, hideCompleted: !showCompleted }),
    [projects, query, filters, portfolioKey, showCompleted],
  );
  const shown = useMemo(() => visible.filter((p) => !hiddenIds.has(p.id)), [visible, hiddenIds]);


  if (view === "programs") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <ViewSwitcher view={view} />
        </div>
        <ProgramsView />
      </div>
    );
  }

  if (isLoading) return <DashboardSkeleton />;
  if (isError) return <ErrorState message={(error as Error)?.message ?? "Unknown error"} onRetry={() => refetch()} />;
  if (!projects || projects.length === 0)
    return <EmptyState title="No initiatives yet" message="Projects will appear here once they exist on the board." />;

  return (
    <div className="space-y-10 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <ViewSwitcher view={view} />
        <ReportActions projects={projects} />
      </div>

      <PortfolioSummary
        projects={projects}
        activeKey={portfolioKey}
        onSelect={(key) => setPortfolioKey((prev) => (prev === key ? null : key))}
      />

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-bold tracking-tight text-foreground">Active Portfolio</h2>
          <span className="text-xs text-muted-foreground">
            {shown.length} of {projects.length}
          </span>
          <div className="ml-auto flex items-center gap-2 print:hidden">
            {hidden.length > 0 ? (
              <button
                onClick={() => setShowHiddenPanel((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <EyeOff className="h-3.5 w-3.5" />
                Hidden ({hidden.length})
              </button>
            ) : null}
            <button
              onClick={() => setShowCompleted((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {showCompleted ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showCompleted ? "Hide completed" : "Show completed"}
            </button>
          </div>
        </div>

        {showHiddenPanel && hidden.length > 0 ? (
          <div className="space-y-2 rounded-lg border border-border bg-card/40 p-4 print:hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Hidden from view ({hidden.length})
              </span>
              {canCurate ? (
                <button
                  onClick={() => hidden.forEach((h) => restoreMutation.mutate(h.id))}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Restore all
                </button>
              ) : (
                <span className="text-[11px] text-muted-foreground">Curated by an admin</span>
              )}
            </div>
            <ul className="divide-y divide-border">
              {hidden.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-foreground/80">{h.name}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      hidden by {h.hiddenBy}
                    </span>
                  </span>
                  {canCurate ? (
                    <button
                      onClick={() => restoreMutation.mutate(h.id)}
                      disabled={restoreMutation.isPending}
                      className="shrink-0 text-xs text-primary transition-colors hover:underline disabled:opacity-50"
                    >
                      Restore
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="print:hidden">
          <FilterPanel filters={filters} owners={owners} onChange={setFilters} onClear={() => setFilters(EMPTY_FILTERS)} />
        </div>
        <ProjectGrid
          projects={shown}
          onHide={
            canCurate
              ? (id) => {
                  const card = shown.find((p) => p.id === id);
                  hideMutation.mutate({ id, name: card?.name ?? id });
                }
              : undefined
          }
        />
      </section>

      <UpcomingDueDates projects={projects} />
    </div>
  );
}
