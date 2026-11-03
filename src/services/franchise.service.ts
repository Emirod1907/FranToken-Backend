import { Contract, formatEther } from "ethers";
import { Op } from "sequelize";
import { sequelize } from "../config/database";
import {
  academicSigner,
  chainWrite,
  projectContracts,
} from "../blockchain/academic";
import { FranchiseApplication } from "../models/franchiseApplication.model";
import { DistributionRequest } from "../models/distributionRequest.model";
import { Project } from "../models/project.model";
import type { User } from "../models/user.model";
import { ApiError } from "../utils/ApiError";
import type { EditApplicationInput } from "../validators/franchise.validator";
import { requireCompleteProfile } from "./account.service";
import {
  managedApplication,
  managedProject,
  requireVersion,
} from "./franchiseAccess.service";
import { auditFranchise, franchiseHistory } from "./franchiseAudit.service";
import { listDistributions } from "./distribution.service";

export async function applicationDetail(actor: User, id: string) {
  const application = await managedApplication(actor, id);
  return {
    application: application.toContract(),
    capabilities: { canEdit: !application.projectId },
    history: await franchiseHistory({ applicationId: id }),
  };
}

export async function editApplication(
  actor: User,
  id: string,
  input: EditApplicationInput,
) {
  await sequelize.transaction(async (transaction) => {
    const application = await managedApplication(actor, id, transaction);
    requireVersion(application.version, input.version);
    if (application.projectId)
      throw ApiError.conflict(
        "La publicación está iniciada o confirmada. Los datos admitidos no se pueden editar.",
      );
    await requireCompleteProfile(application.userId);
    const { version, ...changes } = input;
    application.set({
      ...changes,
      status: "Enviada",
      reviewNote: null,
      version: version + 1,
    });
    await application.save({ transaction });
    await auditFranchise(
      actor,
      "application.resubmitted",
      { applicationId: id },
      { fields: Object.keys(changes), version: application.version },
      transaction,
    );
  });
  return applicationDetail(actor, id);
}

export async function managedFranchises(actor: User) {
  const applications = await FranchiseApplication.findAll({
    where:
      actor.role === "superadmin"
        ? {}
        : { userId: actor.id, status: "Publicada" },
  });
  const ids = applications.flatMap((row) =>
    row.projectId ? [row.projectId] : [],
  );
  const projects = await Project.findAll({
    where: actor.role === "superadmin" ? {} : { id: { [Op.in]: ids } },
    order: [["createdAt", "DESC"]],
  });
  return projects.map((project) => ({
    project: project.toContract(),
    applicationId:
      applications.find((app) => app.projectId === project.id)?.id ?? null,
  }));
}

export async function franchiseDetail(actor: User, id: string) {
  const { project, application } = await managedProject(actor, id);
  let chain: { status: number; supply: string; available: string } | null =
    null;
  let networkError = "";
  try {
    const { token } = await projectContracts(project);
    const [status, supply, cap] = await Promise.all([
      token.projectStatus(),
      token.totalSupply(),
      token.maxSupply(),
    ]);
    chain = {
      status: Number(status),
      supply: supply.toString(),
      available: (cap - supply).toString(),
    };
  } catch (error) {
    networkError =
      error instanceof ApiError
        ? error.message
        : "No se pudo consultar la red. Los datos de la cuenta siguen disponibles.";
  }
  const requests = await DistributionRequest.findAll({
    where: { projectId: id },
    order: [["periodId", "DESC"]],
  });
  return {
    project: project.toContract(),
    application: application?.toContract() ?? null,
    chain,
    networkError,
    capabilities: {
      canStart: chain?.status === 1,
      canClose: chain?.status === 1 || chain?.status === 2,
      canProposeDistribution: chain?.status === 2,
      canExecuteDistribution: actor.role === "superadmin" && chain !== null,
    },
    requests: requests.map((row) => row.toContract()),
    distributions: await listDistributions(id),
    history: await franchiseHistory({ projectId: id }),
  };
}

export async function setFranchiseOperation(
  actor: User,
  id: string,
  status: "en_operacion" | "cerrada",
) {
  const { project, application } = await managedProject(actor, id);
  const next = status === "en_operacion" ? 2 : 3;
  return chainWrite(async () => {
    const { token } = await projectContracts(project);
    const current = Number(await token.projectStatus());
    if (
      current !== next &&
      !(current === 1 && [2, 3].includes(next)) &&
      !(current === 2 && next === 3)
    )
      throw ApiError.conflict(
        "La transición no está permitida. Una franquicia cerrada no se reabre.",
      );
    let txHash: string | null = null;
    let gasFeeEth = "0";
    if (current !== next) {
      const writer = token.connect(await academicSigner("admin")) as Contract;
      const tx = await writer.setProjectStatus(next);
      const receipt = await tx.wait();
      txHash = tx.hash;
      gasFeeEth = formatEther(receipt.fee);
    }
    const changed = project.status !== status;
    await sequelize.transaction(async (transaction) => {
      await project.update({ status }, { transaction });
      if (changed || txHash)
        await auditFranchise(
          actor,
          "franchise.operation",
          { projectId: id, applicationId: application?.id },
          { status, txHash },
          transaction,
        );
    });
    return { project: project.toContract(), txHash, gasFeeEth };
  });
}
