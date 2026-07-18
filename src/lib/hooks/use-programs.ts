"use client";

import { useQuery } from "@tanstack/react-query";
import type { ProgramView } from "@/domain/project";

export function usePrograms() {
  return useQuery<ProgramView>({
    queryKey: ["programs"],
    queryFn: async () => {
      const res = await fetch("/api/programs");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
      return body as ProgramView;
    },
    staleTime: 30_000,
  });
}
