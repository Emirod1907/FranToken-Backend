import { sequelize } from "../config/database";
import { Profile } from "../models/profile.model";
import { Project } from "../models/project.model";
import { User, toSession } from "../models/user.model";
import { FranchiseApplication } from "../models/franchiseApplication.model";
import { approveWallet, publishContract } from "../blockchain/academic";
import { ApiError } from "../utils/ApiError";
import { requireCompleteProfile } from "./account.service";
import {
  requireSuperadminActor,
  requireVersion,
} from "./franchiseAccess.service";
import { auditFranchise } from "./franchiseAudit.service";
import { setFranchiseOperation } from "./franchise.service";

export async function setUserKyc(
  actor: User,
  userId: string,
  approved: boolean,
) {
  requireSuperadminActor(actor);
  const user = await User.findByPk(userId);
  if (!user) throw ApiError.notFound("Usuario no encontrado.");
  if (approved) await requireCompleteProfile(user.id);
  if (!user.walletAddress)
    throw ApiError.conflict("El usuario debe vincular su wallet primero.");
  await approveWallet(user.walletAddress, approved);
  await user.update({ kycApproved: approved });
  return { userId: user.id, kycApproved: approved };
}
export async function listUsers() {
  const users = await User.findAll({ order: [["createdAt", "DESC"]] });
  return Promise.all(
    users.map(async (user) => ({
      ...toSession(user),
      profile:
        (await Profile.findOne({ where: { userId: user.id } }))?.toContract() ??
        null,
    })),
  );
}
export async function updateProject(
  actor: User,
  slug: string,
  patch: { status: "en_operacion" | "cerrada" },
) {
  requireSuperadminActor(actor);
  return setFranchiseOperation(actor, slug, patch.status);
}
export async function listApplications() {
  const rows = await FranchiseApplication.findAll({
    order: [["createdAt", "DESC"]],
  });
  return Promise.all(
    rows.map(async (app) => ({
      ...app.toContract(),
      publication: app.projectId
        ? await Project.findByPk(app.projectId).then((project) =>
            project
              ? { symbol: project.tokenSymbol, totalUnits: project.totalUnits }
              : null,
          )
        : null,
      applicant: (await User.findByPk(app.userId))?.displayName ?? "Usuario",
      profile:
        (
          await Profile.findOne({ where: { userId: app.userId } })
        )?.toContract() ?? null,
    })),
  );
}
export async function reviewApplication(
  actor: User,
  id: string,
  status: "Aprobada" | "Observada",
  note: string,
  version: number,
) {
  requireSuperadminActor(actor);
  return sequelize.transaction(async (tx) => {
    const app = await FranchiseApplication.findByPk(id, {
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });
    if (!app) throw ApiError.notFound("Solicitud no encontrada.");
    requireVersion(app.version, version);
    if (app.projectId)
      throw ApiError.conflict(
        "La solicitud ya tiene una publicación en curso o confirmada.",
      );
    await requireCompleteProfile(app.userId);
    await app.update(
      { status, reviewNote: note, version: app.version + 1 },
      { transaction: tx },
    );
    await auditFranchise(
      actor,
      "application.reviewed",
      { applicationId: id },
      { status, note, version: app.version },
      tx,
    );
    return app.toContract();
  });
}
export async function publishApplication(
  actor: User,
  id: string,
  symbol: string,
  totalUnits: string,
) {
  requireSuperadminActor(actor);
  const project = await sequelize.transaction(async (tx) => {
    const app = await FranchiseApplication.findByPk(id, {
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });
    if (!app) throw ApiError.notFound("Solicitud no encontrada.");
    if (!["Aprobada", "Publicada"].includes(app.status))
      throw ApiError.conflict("Primero aprobá la solicitud.");
    await requireCompleteProfile(app.userId);
    const projectId = app.projectId ?? `solicitud-${app.id}`;
    let project = await Project.findByPk(projectId, { transaction: tx });
    if (!project) {
      project = await Project.create(
        {
          id: projectId,
          name: app.franchiseName,
          sector: app.sector,
          format: app.sector,
          descriptor: app.description,
          company:
            "Proyecto académico presentado por un usuario. Sin alianza de marca acreditada.",
          franchise: app.description,
          officialUrl: "",
          logoUrl: null,
          palette: "mint",
          annualizedRoiScenario: [],
          status: "publicada",
          unitPriceMinor: "1000",
          currency: "USD",
          currencyDecimals: 2,
          tokenSymbol: symbol,
          totalUnits,
          unitsSold: "0",
        },
        { transaction: tx },
      );
      await app.update(
        { projectId, version: app.version + 1 },
        { transaction: tx },
      );
      await auditFranchise(
        actor,
        "application.publishing",
        { applicationId: id, projectId },
        { symbol, totalUnits },
        tx,
      );
    }
    if (project.tokenSymbol !== symbol || project.totalUnits !== totalUnits)
      throw ApiError.conflict(
        "La publicación pendiente tiene otro símbolo o cupo.",
      );
    return project;
  });
  const addresses = await publishContract(
    project.id,
    project.name,
    symbol,
    totalUnits,
  );
  await sequelize.transaction(async (transaction) => {
    const application = await FranchiseApplication.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!application) throw ApiError.notFound("Solicitud no encontrada.");
    await project.update(addresses, { transaction });
    if (application.status !== "Publicada") {
      await application.update(
        { status: "Publicada", version: application.version + 1 },
        { transaction },
      );
      await auditFranchise(
        actor,
        "application.published",
        { applicationId: id, projectId: project.id },
        { symbol, totalUnits },
        transaction,
      );
    }
  });
  return project.toContract();
}
