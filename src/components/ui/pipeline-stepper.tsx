import { PHASE, type ProjectPhase, type ProjectStatus } from "@/domain/project";
import { cn } from "@/lib/utils";

const PIPELINE_PHASES = PHASE.filter((p) => p !== "Completed");

function toneClasses(status: ProjectStatus, isPastDue: boolean) {
  if (status === "Blocked") return "bg-status-orange";
  if (status === "Completed") return "bg-status-green";
  if (isPastDue) return "bg-status-orange";
  return "bg-primary";
}

/**
 * Compact horizontal stepper showing where a project sits in the delivery
 * pipeline (Planned -> ... -> Validation -> Completed). This is the primary
 * "where are we" signal for ELT scanning the portfolio grid.
 */
export function PipelineStepper({
  phase,
  status,
  isPastDue = false,
  className,
}: {
  phase: ProjectPhase;
  status: ProjectStatus;
  isPastDue?: boolean;
  className?: string;
}) {
  const isCompleted = phase === "Completed";
  const currentIndex = isCompleted ? PIPELINE_PHASES.length - 1 : PIPELINE_PHASES.indexOf(phase);
  const fillClass = toneClasses(status, isPastDue);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex gap-1">
        {PIPELINE_PHASES.map((p, i) => (
          <span
            key={p}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              isCompleted || i <= currentIndex ? fillClass : "bg-muted",
            )}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground">{phase}</span>
        <span>
          Stage {isCompleted ? PIPELINE_PHASES.length : currentIndex + 1} of {PIPELINE_PHASES.length}
        </span>
      </div>
    </div>
  );
}
