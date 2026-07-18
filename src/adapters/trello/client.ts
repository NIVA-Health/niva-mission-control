import "server-only";
import type { TrelloAction, TrelloCard, TrelloList, TrelloMember } from "./types";

interface TrelloCredentials {
  apiKey: string;
  token: string;
  /** High-level programme/initiative board (Scrum Master board). Optional. */
  programBoardId: string | null;
  /** Granular delivery boards (team sprint boards). At least one required. */
  deliveryBoardIds: string[];
  revalidate: number;
}

export function readTrelloCredentials(): TrelloCredentials {
  const apiKey = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;

  // TRELLO_BOARD_ID remains supported as the single-board form we shipped first.
  const deliveryRaw = process.env.TRELLO_DELIVERY_BOARD_IDS ?? process.env.TRELLO_BOARD_ID ?? "";
  const deliveryBoardIds = deliveryRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const programBoardId = process.env.TRELLO_PROGRAM_BOARD_ID?.trim() || null;

  if (!apiKey || !token || deliveryBoardIds.length === 0) {
    throw new Error(
      "Trello is not configured. Set TRELLO_API_KEY, TRELLO_TOKEN and TRELLO_DELIVERY_BOARD_IDS " +
        "(or TRELLO_BOARD_ID) in .env.local, or set DATA_SOURCE=mock to preview with sample data.",
    );
  }

  const revalidate = Number(process.env.DATA_REVALIDATE_SECONDS ?? "60");
  return {
    apiKey,
    token,
    programBoardId,
    deliveryBoardIds,
    revalidate: Number.isFinite(revalidate) ? revalidate : 60,
  };
}

const BASE = "https://api.trello.com/1";

async function get<T>(path: string, params: Record<string, string>, creds: TrelloCredentials): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("key", creds.apiKey);
  url.searchParams.set("token", creds.token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    // Server-side cache; keeps the exec view fast and rate-limit friendly.
    next: { revalidate: creds.revalidate },
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Trello API ${res.status} on ${path}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }
  return (await res.json()) as T;
}

export interface TrelloBoardBundle {
  boardId: string;
  lists: TrelloList[];
  members: TrelloMember[];
  cards: TrelloCard[];
  actions: TrelloAction[];
}

/** Everything Mission Control reads, across every configured board. */
export interface TrelloWorkspaceBundle {
  /** Programme board bundle, when TRELLO_PROGRAM_BOARD_ID is configured. */
  program: TrelloBoardBundle | null;
  /** One bundle per delivery board. */
  delivery: TrelloBoardBundle[];
}

async function fetchBoardBundle(boardId: string, creds: TrelloCredentials): Promise<TrelloBoardBundle> {
  const [lists, members, cards, actions] = await Promise.all([
    get<TrelloList[]>(`/boards/${boardId}/lists`, { fields: "id,name", filter: "open" }, creds),
    get<TrelloMember[]>(
      `/boards/${boardId}/members`,
      { fields: "id,fullName,username,initials,avatarUrl" },
      creds,
    ),
    get<TrelloCard[]>(
      `/boards/${boardId}/cards`,
      {
        filter: "open",
        fields: "id,name,desc,idList,idMembers,labels,due,dateLastActivity,badges,closed",
        // Explicit max: without it we are relying on an undocumented default
        // page size, which risks silently truncating a large board.
        limit: "1000",
      },
      creds,
    ),
    get<TrelloAction[]>(
      `/boards/${boardId}/actions`,
      { filter: "createCard,updateCard,commentCard,updateCheckItemStateOnCard", limit: "200" },
      creds,
    ).catch(() => [] as TrelloAction[]),
  ]);

  return { boardId, lists, members, cards, actions };
}

/** Reads every configured board in parallel. */
export async function fetchWorkspaceBundle(
  creds = readTrelloCredentials(),
): Promise<TrelloWorkspaceBundle> {
  const [program, ...delivery] = await Promise.all([
    creds.programBoardId ? fetchBoardBundle(creds.programBoardId, creds) : Promise.resolve(null),
    ...creds.deliveryBoardIds.map((id) => fetchBoardBundle(id, creds)),
  ]);
  return { program, delivery };
}
