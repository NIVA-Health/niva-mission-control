import { CheckCircle2, Activity, Circle, Ban } from "lucide-react";
import { Badge } from "./badge";
import type { ProjectStatus } from "@/domain/project";

const MAP = {
  Completed: { tone: "green", Icon: CheckCircle2 },
  Active: { tone: "blue", Icon: Activity },
  "Not Started": { tone: "gray", Icon: Circle },
  Blocked: { tone: "orange", Icon: Ban },
} as const;

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const { tone, Icon } = MAP[status];
  return (
    <Badge tone={tone}>
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  );
}
