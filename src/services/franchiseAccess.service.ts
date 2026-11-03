import type { Transaction } from "sequelize";
import { FranchiseApplication } from "../models/franchiseApplication.model";
import { FranchisePerformance } from "../models/franchisePerformance.model";
import { Project } from "../models/project.model";
import type { User } from "../models/user.model";
import { ApiError } from "../utils/ApiError";

export function requireSuperadminActor(actor: User) {
  if (actor.role !== "superadmin")
    throw ApiError.forbidden("Se requiere acceso de superadmin.");
}
export function requireVersion(actual: number, expected: number) {
  if (actual !== expected)
    throw ApiError.conflict(
      "Los datos cambiaron. Actualizá la pantalla antes de continuar.",
    );
}
export async function managedApplication(
  actor: User,
  id: string,
  transaction?: Transaction,
) {
  const application = await FranchiseApplication.findOne({
    where: { id, ...(actor.role !== "superadmin" ? { userId: actor.id } : {}) },
    ...(!transaction
      ? { include: [{ model: FranchisePerformance, as: "performance" }] }
      : {}),
    transaction,
    ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
  });
  if (!application) throw ApiError.notFound("Solicitud no encontrada.");
  return application;
}
export async function managedProject(actor: User, id: string) {
  const application = await FranchiseApplication.findOne({
    where: { projectId: id },
  });
  if (
    actor.role !== "superadmin" &&
    (!application ||
      application.userId !== actor.id ||
      application.status !== "Publicada")
  )
    throw ApiError.notFound("Franquicia no encontrada.");
  const project = await Project.findByPk(id);
  if (!project) throw ApiError.notFound("Franquicia no encontrada.");
  return { project, application };
}
