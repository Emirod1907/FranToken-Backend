import { Project } from "../models/project.model";
import { ApiError } from "../utils/ApiError";

export async function listProjects() {
  const projects = await Project.findAll({
    order: [
      ["featuredRank", "ASC"],
      ["name", "ASC"],
    ],
  });
  return projects.map((p) => p.toContract());
}

export async function getProjectBySlug(slug: string) {
  const project = await Project.findByPk(slug);
  if (!project) {
    throw ApiError.notFound("Proyecto no encontrado.");
  }
  return project.toContract();
}
