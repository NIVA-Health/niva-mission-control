"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface HiddenCard {
  id: string;
  name: string;
  hiddenBy: string;
  hiddenAt: string;
}

async function json(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body;
}

/** Who is viewing, and may they curate the board for everyone? */
export function useViewer() {
  return useQuery<{ email: string | null; isAdmin: boolean }>({
    queryKey: ["me"],
    queryFn: async () => json("/api/me"),
    staleTime: 5 * 60_000,
  });
}

/** The shared hidden list — same for every viewer. */
export function useHiddenCards() {
  return useQuery<HiddenCard[]>({
    queryKey: ["hidden"],
    queryFn: async () => (await json("/api/hidden")).hidden ?? [],
    staleTime: 30_000,
  });
}

export function useHideCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (card: { id: string; name: string }) =>
      json("/api/hidden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(card),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hidden"] }),
  });
}

export function useRestoreCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      json(`/api/hidden?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hidden"] }),
  });
}
