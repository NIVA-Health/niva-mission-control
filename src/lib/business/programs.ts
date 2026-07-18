import type { ProgramView, Project, ProjectChild } from "@/domain/project";

/**
 * Rolls delivery work up under programme cards.
 *
 * The join key is the "Programme | Child" naming convention already used on the
 * delivery board: a card named "Note Scrubber | [Phase 2A] ..." belongs to the
 * programme card named "Note Scrubber".
 *
 * This is a string match, which means a renamed programme card orphans its
 * children. That is why unmapped work is returned explicitly rather than
 * dropped — on an executive board, work must never disappear silently.
 */

function joinKey(name: string): string {
  return name.trim().toLowerCase();
}

function toChild(p: Project): ProjectChild {
  return { id: p.id, name: p.name, phase: p.phase, status: p.status, owners: p.owners };
}

/** Strips the "Programme | " prefix so children read cleanly under their parent. */
function childLabel(p: Project): string {
  const idx = p.name.indexOf(" | ");
  return idx > 0 ? p.name.slice(idx + 3).trim() : p.name;
}

export function buildProgramView(programCards: Project[], deliveryCards: Project[]): ProgramView {
  const byKey = new Map<string, Project[]>();
  const unmapped: Project[] = [];

  for (const card of deliveryCards) {
    if (!card.programName) continue; // standalone delivery work, not programme work
    const key = joinKey(card.programName);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(card);
    else byKey.set(key, [card]);
  }

  const matched = new Set<string>();

  const programs = programCards.map((program): Project => {
    const key = joinKey(program.name);
    const kids = byKey.get(key) ?? [];
    if (kids.length) matched.add(key);

    const children: ProjectChild[] = kids.map((k) => ({ ...toChild(k), name: childLabel(k) }));
    const complete = children.filter((c) => c.status === "Completed").length;

    // With children, progress is MEASURED (completed / total) rather than
    // estimated from pipeline phase.
    const progress = children.length ? Math.round((complete / children.length) * 100) : program.progress;

    // A programme inherits the most urgent signal from its children: any blocked
    // child blocks the programme; all children complete completes it.
    let status = program.status;
    if (children.length) {
      if (children.some((c) => c.status === "Blocked")) status = "Blocked";
      else if (complete === children.length) status = "Completed";
      else if (status === "Completed") status = "Active";
    }

    return {
      ...program,
      children,
      progress,
      status,
      checklistDone: children.length ? complete : program.checklistDone,
      checklistTotal: children.length ? children.length : program.checklistTotal,
    };
  });

  // Delivery work whose programme prefix has no matching programme card.
  for (const [key, kids] of byKey) {
    if (!matched.has(key)) unmapped.push(...kids);
  }

  return { programs, unmapped };
}
