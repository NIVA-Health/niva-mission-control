"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Layers, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

export type DashboardViewMode = "delivery" | "programs";

/**
 * View is URL-driven (?view=programs) so it survives refresh and can be shared
 * as a link — an executive can be sent straight to the programme roll-up.
 */
export function ViewSwitcher({ view }: { view: DashboardViewMode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const select = (next: DashboardViewMode) => {
    const q = new URLSearchParams(Array.from(params.entries()));
    q.set("view", next);
    router.replace(`${pathname}?${q.toString()}`);
  };

  const options: { value: DashboardViewMode; label: string; Icon: typeof Layers }[] = [
    { value: "programs", label: "Programmes", Icon: Layers },
    { value: "delivery", label: "Delivery", Icon: LayoutGrid },
  ];

  return (
    <div className="inline-flex items-center rounded-md border border-border bg-card/60 p-0.5 print:hidden">
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          onClick={() => select(value)}
          aria-pressed={view === value}
          className={cn(
            "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors",
            view === value
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
