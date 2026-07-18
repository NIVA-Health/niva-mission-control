"use client";

import { useMemo, useState } from "react";
import { Layers, AlertTriangle, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePrograms } from "@/lib/hooks/use-programs";
import { useHiddenCards, useHideCard, useViewer } from "@/lib/hooks/use-hidden";
import { PortfolioSummary, type PortfolioFilterKey } from "./portfolio-summary";
import { ProjectGrid } from "./project-grid";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { OwnerAvatars } from "@/components/ui/owner-avatars";

export function ProgramsView() {
  const { data, isLoading, isError, error, refetch } = usePrograms();
  const { data: viewer } = useViewer();
  const { data: hiddenEntries } = useHiddenCards();
  const hideMutation = useHideCard();
  const [portfolioKey, setPortfolioKey] = useState<PortfolioFilterKey | null>(null);
  const [showUnmapped, setShowUnmapped] = useState(false);

  const canCurate = viewer?.isAdmin ?? false;
  const hiddenIds = useMemo(
    () => new Set((hiddenEntries ?? []).map((h) => h.id)),
    [hiddenEntries],
  );

  const programs = useMemo(
    () => (data?.programs ?? []).filter((p) => !hiddenIds.has(p.id)),
    [data, hiddenIds],
  );
  const unmapped = useMemo(
    () => (data?.unmapped ?? []).filter((p) => !hiddenIds.has(p.id)),
    [data, hiddenIds],
  );

  if (isLoading) return <DashboardSkeleton />;
  if (isError)
    return <ErrorState message={(error as Error)?.message ?? "Unknown error"} onRetry={() => refetch()} />;

  if (programs.length === 0 && unmapped.length === 0)
    return (
      <EmptyState
        title="No programmes yet"
        message="Add programme cards to the Scrum board, or set TRELLO_PROGRAM_BOARD_ID to point at it."
      />
    );

  // Group unmapped delivery work by the programme name it references, so the
  // gap reads as "this programme has no card" rather than a wall of tasks.
  const unmappedByProgram = new Map<string, number>();
  for (const card of unmapped) {
    const key = card.programName ?? "Unknown";
    unmappedByProgram.set(key, (unmappedByProgram.get(key) ?? 0) + 1);
  }

  return (
    <div className="space-y-10 animate-fade-in">
      {programs.length > 0 ? (
        <PortfolioSummary
          projects={programs}
          activeKey={portfolioKey}
          onSelect={(key) => setPortfolioKey((prev) => (prev === key ? null : key))}
        />
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-bold tracking-tight text-foreground">Programmes</h2>
          <span className="text-xs text-muted-foreground">{programs.length}</span>
        </div>
        <ProjectGrid
          projects={programs}
          onHide={
            canCurate
              ? (id) => {
                  const card = programs.find((p) => p.id === id);
                  hideMutation.mutate({ id, name: card?.name ?? id });
                }
              : undefined
          }
        />
      </section>

      {unmapped.length > 0 ? (
        <section className="space-y-3">
          <button
            onClick={() => setShowUnmapped((v) => !v)}
            className="flex w-full items-center gap-2 text-left"
          >
            <AlertTriangle className="h-4 w-4 text-status-gold" />
            <h2 className="text-base font-bold tracking-tight text-foreground">Unmapped work</h2>
            <span className="rounded-full bg-status-gold/10 px-2 py-0.5 text-xs font-medium text-status-gold">
              {unmapped.length}
            </span>
            <ChevronRight
              className={`h-4 w-4 text-muted-foreground transition-transform ${showUnmapped ? "rotate-90" : ""}`}
            />
          </button>
          <p className="text-xs text-muted-foreground">
            Delivery work whose programme has no card on the programme board. It is counted here so
            nothing disappears from the executive view.
          </p>

          <Card className="divide-y divide-border overflow-hidden">
            {Array.from(unmappedByProgram.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([name, count]) => (
                <div key={name} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm font-medium text-foreground">{name}</span>
                  <span className="text-xs text-muted-foreground">
                    {count} card{count === 1 ? "" : "s"} · no programme card
                  </span>
                </div>
              ))}
          </Card>

          {showUnmapped ? (
            <Card className="divide-y divide-border overflow-hidden">
              {unmapped.map((p) => (
                <Link
                  key={p.id}
                  href={`/project/${p.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-elevated"
                >
                  <span className="min-w-0 truncate text-sm text-foreground/90">{p.name}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <OwnerAvatars owners={p.owners} />
                    <StatusBadge status={p.status} />
                  </span>
                </Link>
              ))}
            </Card>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
