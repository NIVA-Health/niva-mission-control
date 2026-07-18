import "server-only";
import type { ProgramView, Project } from "@/domain/project";
import { ProjectsSchema } from "@/domain/project";
import type { ProjectRepository } from "@/repository/project-repository";
import { fetchWorkspaceBundle } from "./client";
import { bundleToProjects } from "./mappers";
import { buildProgramView } from "@/lib/business/programs";

/**
 * Live Trello implementation of ProjectRepository.
 *
 * Reads every configured board, maps to domain Projects, validates with Zod.
 * Delivery boards provide the granular view; the optional programme board
 * provides the executive roll-up.
 */
export class TrelloAdapter implements ProjectRepository {
  private async load(): Promise<{ delivery: Project[]; program: Project[] }> {
    const bundle = await fetchWorkspaceBundle();
    const delivery = bundle.delivery.flatMap((b) => bundleToProjects(b, "delivery"));
    const program = bundle.program ? bundleToProjects(bundle.program, "program") : [];
    return {
      delivery: ProjectsSchema.parse(delivery),
      program: ProjectsSchema.parse(program),
    };
  }

  async getProjects(): Promise<Project[]> {
    return (await this.load()).delivery;
  }

  async getProjectById(id: string): Promise<Project | null> {
    const { delivery, program } = await this.load();
    return [...delivery, ...program].find((p) => p.id === id) ?? null;
  }

  async getPrograms(): Promise<ProgramView> {
    const { delivery, program } = await this.load();
    return buildProgramView(program, delivery);
  }
}
