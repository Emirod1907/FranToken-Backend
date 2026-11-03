import { Op } from "sequelize";
import { Project } from "../models/project.model";
import { ApiError } from "../utils/ApiError";
import { projectContracts } from "../blockchain/academic";

async function serialize(project: Project) {
  const { token } = await projectContracts(project);
  const [state, supply, cap] = await Promise.all([
    token.projectStatus(),
    token.totalSupply(),
    token.maxSupply(),
  ]);
  const result = project.toContract();
  return {
    ...result,
    status: ["borrador", "publicada", "en_operacion", "cerrada"][Number(state)],
    availability: {
      totalUnits: cap.toString(),
      unitsSold: supply.toString(),
      unitsAvailable: (cap - supply).toString(),
    },
  };
}
export async function listProjects() {
  const projects = await Project.findAll({
    where: {
      tokenAddress: { [Op.ne]: null },
      investmentAgreementAddress: { [Op.ne]: null },
    },
    order: [
      ["featuredRank", "ASC"],
      ["name", "ASC"],
    ],
  });
  return Promise.all(projects.map(serialize));
}
export async function getProjectBySlug(slug: string) {
  const project = await Project.findByPk(slug);
  if (!project?.isOnChain) throw ApiError.notFound("Proyecto no publicado.");
  return serialize(project);
}
