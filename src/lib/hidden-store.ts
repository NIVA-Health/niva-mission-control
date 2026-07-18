import "server-only";

/**
 * Shared "hidden from view" list.
 *
 * Cards such as Lynn's placeholder/template cards and Trello's own helper cards
 * are legitimate board content but are not initiatives, so they should not
 * appear on an executive view. Hiding is a VIEW preference — it never mutates
 * Trello.
 *
 * Storage: Firestore via its REST API, authenticated with the Cloud Run
 * metadata-server token. Deliberately no @google-cloud/firestore dependency —
 * this stores a handful of ids, and the SDK pulls in gRPC for no benefit here.
 *
 * Locally (no metadata server) it falls back to an in-memory map so
 * `npm run dev` works without GCP credentials.
 */

export interface HiddenCard {
  id: string;
  name: string;
  hiddenBy: string;
  hiddenAt: string;
}

const COLLECTION = "missionControlHiddenCards";
const METADATA = "http://metadata.google.internal/computeMetadata/v1";

/** Cloud Run always sets K_SERVICE; its absence means local development. */
const useMemoryStore = !process.env.K_SERVICE;
const memory = new Map<string, HiddenCard>();

async function metadata(path: string): Promise<string> {
  const res = await fetch(`${METADATA}/${path}`, {
    headers: { "Metadata-Flavor": "Google" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`metadata ${path} -> ${res.status}`);
  return res.text();
}

async function accessToken(): Promise<string> {
  const raw = await metadata("instance/service-accounts/default/token");
  return (JSON.parse(raw) as { access_token: string }).access_token;
}

async function projectId(): Promise<string> {
  return (
    process.env.FIRESTORE_PROJECT_ID ??
    process.env.GOOGLE_CLOUD_PROJECT ??
    (await metadata("project/project-id"))
  );
}

async function documentsUrl(): Promise<string> {
  const project = await projectId();
  return `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${COLLECTION}`;
}

/** Firestore REST represents every field as a typed wrapper. */
function toFields(card: HiddenCard) {
  return {
    fields: {
      id: { stringValue: card.id },
      name: { stringValue: card.name },
      hiddenBy: { stringValue: card.hiddenBy },
      hiddenAt: { stringValue: card.hiddenAt },
    },
  };
}

interface RestDocument {
  fields?: Record<string, { stringValue?: string }>;
}

function fromFields(doc: RestDocument): HiddenCard | null {
  const f = doc.fields;
  if (!f?.id?.stringValue) return null;
  return {
    id: f.id.stringValue,
    name: f.name?.stringValue ?? f.id.stringValue,
    hiddenBy: f.hiddenBy?.stringValue ?? "unknown",
    hiddenAt: f.hiddenAt?.stringValue ?? "",
  };
}

export async function listHidden(): Promise<HiddenCard[]> {
  if (useMemoryStore) return [...memory.values()];
  try {
    const url = `${await documentsUrl()}?pageSize=300`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${await accessToken()}` },
      cache: "no-store",
    });
    // An empty collection returns 200 with no `documents` key.
    if (!res.ok) throw new Error(`firestore list ${res.status}`);
    const body = (await res.json()) as { documents?: RestDocument[] };
    return (body.documents ?? []).map(fromFields).filter((c): c is HiddenCard => c !== null);
  } catch (err) {
    // Degrade gracefully: a Firestore problem should not take the dashboard
    // down — it should just mean nothing is hidden on this request.
    console.error("hidden-store: read failed", err);
    return [];
  }
}

/** Writes propagate errors so an admin sees when an action failed. */
export async function hideCard(card: { id: string; name: string }, by: string): Promise<HiddenCard> {
  const entry: HiddenCard = {
    id: card.id,
    name: card.name,
    hiddenBy: by,
    hiddenAt: new Date().toISOString(),
  };
  if (useMemoryStore) {
    memory.set(entry.id, entry);
    return entry;
  }
  const url = `${await documentsUrl()}?documentId=${encodeURIComponent(entry.id)}`;
  let res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(toFields(entry)),
  });
  // 409 = already hidden; overwrite it so hiddenBy/hiddenAt stay current.
  if (res.status === 409) {
    res = await fetch(`${await documentsUrl()}/${encodeURIComponent(entry.id)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(toFields(entry)),
    });
  }
  if (!res.ok) throw new Error(`Firestore write failed (${res.status})`);
  return entry;
}

export async function restoreCard(id: string): Promise<void> {
  if (useMemoryStore) {
    memory.delete(id);
    return;
  }
  const res = await fetch(`${await documentsUrl()}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${await accessToken()}` },
  });
  if (!res.ok && res.status !== 404) throw new Error(`Firestore delete failed (${res.status})`);
}
