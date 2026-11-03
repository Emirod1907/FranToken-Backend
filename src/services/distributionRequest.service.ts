import { formatUnits, parseUnits } from "ethers";
import { sequelize } from "../config/database";
import { academicRuntime, projectContracts } from "../blockchain/academic";
import { DistributionRequest } from "../models/distributionRequest.model";
import { Distribution } from "../models/distribution.model";
import { Project } from "../models/project.model";
import type { User } from "../models/user.model";
import { ApiError } from "../utils/ApiError";
import {
  managedProject,
  requireSuperadminActor,
  requireVersion,
} from "./franchiseAccess.service";
import { auditFranchise } from "./franchiseAudit.service";
import { distribute } from "./distribution.service";

async function operatingProject(actor: User, projectId: string) {
  const { project } = await managedProject(actor, projectId);
  const { token } = await projectContracts(project);
  if (Number(await token.projectStatus()) !== 2)
    throw ApiError.conflict(
      "La franquicia debe estar en operación para proponer un reparto.",
    );
}
export async function listDistributionRequests(
  actor: User,
  projectId?: string,
) {
  if (projectId) await managedProject(actor, projectId);
  else requireSuperadminActor(actor);
  const rows = await DistributionRequest.findAll({
    where: projectId ? { projectId } : {},
    order: [["createdAt", "DESC"]],
  });
  return Promise.all(
    rows.map(async (row) => ({
      ...row.toContract(),
      franchiseName:
        (await Project.findByPk(row.projectId))?.name ?? "Franquicia",
    })),
  );
}
export async function proposeDistribution(
  actor: User,
  projectId: string,
  input: { periodId: string; amount: string; memo?: string },
) {
  await operatingProject(actor, projectId);
  const amountMinor = parseUnits(input.amount, 6).toString();
  if (BigInt(amountMinor) <= 0n)
    throw ApiError.badRequest("Ingresá un importe positivo.");
  if (
    await Distribution.findOne({
      where: { projectId, periodId: input.periodId },
    })
  )
    throw ApiError.conflict("El período ya tiene una distribución registrada.");
  return sequelize.transaction(async (transaction) => {
    const request = await DistributionRequest.create(
      {
        projectId,
        periodId: input.periodId,
        amountMinor,
        memo: input.memo ?? "",
        createdByUserId: actor.id,
      },
      { transaction },
    );
    await auditFranchise(
      actor,
      "distribution.proposed",
      { projectId },
      { requestId: request.id, periodId: request.periodId, amountMinor },
      transaction,
    );
    return request.toContract();
  });
}
export async function editDistributionRequest(
  actor: User,
  projectId: string,
  id: string,
  input: { amount: string; memo?: string; version: number },
) {
  await operatingProject(actor, projectId);
  const amountMinor = parseUnits(input.amount, 6).toString();
  if (BigInt(amountMinor) <= 0n)
    throw ApiError.badRequest("Ingresá un importe positivo.");
  return sequelize.transaction(async (transaction) => {
    const request = await DistributionRequest.findOne({
      where: { id, projectId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!request) throw ApiError.notFound("Propuesta no encontrada.");
    requireVersion(request.version, input.version);
    if (!["pending", "observed"].includes(request.status))
      throw ApiError.conflict(
        "El reparto ya se está ejecutando o está confirmado.",
      );
    await request.update(
      {
        amountMinor,
        memo: input.memo ?? "",
        status: "pending",
        reviewNote: "",
        reviewedByUserId: null,
        version: request.version + 1,
      },
      { transaction },
    );
    await auditFranchise(
      actor,
      "distribution.corrected",
      { projectId },
      { requestId: id, amountMinor, version: request.version },
      transaction,
    );
    return request.toContract();
  });
}
export async function observeDistributionRequest(
  actor: User,
  id: string,
  version: number,
  note: string,
) {
  requireSuperadminActor(actor);
  return sequelize.transaction(async (transaction) => {
    const request = await DistributionRequest.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!request) throw ApiError.notFound("Propuesta no encontrada.");
    requireVersion(request.version, version);
    if (request.status !== "pending")
      throw ApiError.conflict("Solo se pueden observar propuestas pendientes.");
    await request.update(
      {
        status: "observed",
        reviewNote: note,
        reviewedByUserId: actor.id,
        version: version + 1,
      },
      { transaction },
    );
    await auditFranchise(
      actor,
      "distribution.observed",
      { projectId: request.projectId },
      { requestId: id, note },
      transaction,
    );
    return request.toContract();
  });
}
export async function executeDistributionRequest(
  actor: User,
  id: string,
  version: number,
) {
  requireSuperadminActor(actor);
  await academicRuntime(true);
  const request = await sequelize.transaction(async (transaction) => {
    const row = await DistributionRequest.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!row) throw ApiError.notFound("Propuesta no encontrada.");
    if (row.status === "pending") {
      requireVersion(row.version, version);
      const project = await Project.findByPk(row.projectId);
      if (!project) throw ApiError.notFound("Franquicia no encontrada.");
      const { token } = await projectContracts(project);
      if (Number(await token.projectStatus()) !== 2)
        throw ApiError.conflict(
          "La franquicia debe estar en operación antes de aprobar el reparto.",
        );
      await row.update(
        {
          status: "executing",
          reviewedByUserId: actor.id,
          version: version + 1,
        },
        { transaction },
      );
      await auditFranchise(
        actor,
        "distribution.executing",
        { projectId: row.projectId },
        { requestId: id, periodId: row.periodId, amountMinor: row.amountMinor },
        transaction,
      );
    } else if (!["executing", "confirmed"].includes(row.status))
      throw ApiError.conflict(
        "La propuesta observada debe corregirse y reenviarse.",
      );
    return row;
  });
  // Los reintentos usan exclusivamente el contenido almacenado, incluso tras un timeout.
  const result = await distribute(actor.id, {
    projectId: request.projectId,
    periodId: request.periodId,
    amount: formatUnits(request.amountMinor, 6),
    memo: request.memo,
  });
  await sequelize.transaction(async (transaction) => {
    const row = await DistributionRequest.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!row) throw ApiError.notFound("Propuesta no encontrada.");
    if (row.status !== "confirmed") {
      await row.update(
        {
          status: "confirmed",
          distributionId: result.distribution.id,
          version: row.version + 1,
        },
        { transaction },
      );
      await auditFranchise(
        actor,
        "distribution.confirmed",
        { projectId: row.projectId },
        {
          requestId: id,
          distributionId: result.distribution.id,
          txHash: result.txHash,
        },
        transaction,
      );
    }
  });
  return {
    ...result,
    request: (await DistributionRequest.findByPk(id))!.toContract(),
  };
}

export async function distributeAsSuperadmin(
  actor: User,
  input: { projectId: string; periodId: string; amount: string; memo?: string },
) {
  requireSuperadminActor(actor);
  const request = await DistributionRequest.findOne({
    where: { projectId: input.projectId, periodId: input.periodId },
  });
  if (request) {
    if (parseUnits(input.amount, 6).toString() !== request.amountMinor)
      throw ApiError.conflict(
        "El importe no coincide con la propuesta registrada.",
      );
    return executeDistributionRequest(actor, request.id, request.version);
  }
  const result = await distribute(actor.id, input);
  if (!result.idempotent)
    await auditFranchise(
      actor,
      "distribution.confirmed",
      { projectId: input.projectId },
      {
        distributionId: result.distribution.id,
        periodId: input.periodId,
        txHash: result.txHash,
      },
    );
  return result;
}
