import { Contract, formatEther } from "ethers";
import { sequelize } from "../config/database";
import { Profile } from "../models/profile.model";
import { Project } from "../models/project.model";
import { User, toSession } from "../models/user.model";
import { FranchiseApplication } from "../models/franchiseApplication.model";
import {
  academicSigner,
  approveWallet,
  chainWrite,
  projectContracts,
  publishContract,
} from "../blockchain/academic";
import { ApiError } from "../utils/ApiError";
import { requireCompleteProfile } from "./account.service";

export async function setUserKyc(userId: string, approved: boolean) {
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
  slug: string,
  patch: { status?: "publicada" | "en_operacion" | "cerrada" },
) {
  const project = await Project.findByPk(slug);
  if (!project) throw ApiError.notFound("Proyecto no encontrado.");
  if (!patch.status) throw ApiError.badRequest("Seleccioná un estado.");
  const next = { publicada: 1, en_operacion: 2, cerrada: 3 }[patch.status];
  const result = await chainWrite(async () => {
    const { token } = await projectContracts(project);
    if (Number(await token.projectStatus()) === next)
      return { txHash: null, gasFeeEth: "0" };
    const writer = token.connect(await academicSigner("admin")) as Contract;
    const tx = await writer.setProjectStatus(next);
    const receipt = await tx.wait();
    return { txHash: tx.hash, gasFeeEth: formatEther(receipt.fee) };
  });
  await project.update({ status: patch.status });
  return { ...result, project: project.toContract() };
}
export async function listApplications() {
  const rows = await FranchiseApplication.findAll({
    order: [["createdAt", "DESC"]],
  });
  return Promise.all(
    rows.map(async (app) => ({
      ...app.toContract(),
      applicant: (await User.findByPk(app.userId))?.displayName ?? "Usuario",
      profile:
        (
          await Profile.findOne({ where: { userId: app.userId } })
        )?.toContract() ?? null,
    })),
  );
}
export async function reviewApplication(
  id: string,
  status: "Aprobada" | "Observada",
  note: string,
) {
  return sequelize.transaction(async (tx) => {
    const app = await FranchiseApplication.findByPk(id, {
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });
    if (!app) throw ApiError.notFound("Solicitud no encontrada.");
    if (app.projectId)
      throw ApiError.conflict(
        "La solicitud ya tiene una publicación en curso o confirmada.",
      );
    await requireCompleteProfile(app.userId);
    await app.update({ status, reviewNote: note }, { transaction: tx });
    return app.toContract();
  });
}
export async function publishApplication(
  id: string,
  symbol: string,
  totalUnits: string,
) {
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
      await app.update({ projectId }, { transaction: tx });
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
  await project.update({ ...addresses, status: "publicada" });
  await FranchiseApplication.update({ status: "Publicada" }, { where: { id } });
  return project.toContract();
}
