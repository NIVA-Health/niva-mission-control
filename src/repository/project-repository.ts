import type { ProgramView, Project } from "@/domain/project";

/**
 * The business + presentation layers depend only on this interface.
 * Data adapters (Trello today, BigQuery tomorrow) implement it.
 */
export interface ProjectRepository {
  /** Granular delivery work — the team-level view. */
  getProjects(): Promise<Project[]>;
  getProjectById(id: string): Promise<Project | null>;
  /** Programme roll-up — the executive view. */
  getPrograms(): Promise<ProgramView>;
}
