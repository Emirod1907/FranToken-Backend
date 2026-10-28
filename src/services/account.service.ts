import { getAddress } from "ethers";
import { sequelize } from "../config/database";
import { ApplicationDraft } from "../models/applicationDraft.model";
import { FranchiseApplication } from "../models/franchiseApplication.model";
import { FranchisePerformance } from "../models/franchisePerformance.model";
import { Profile } from "../models/profile.model";
import { TokenActivity } from "../models/tokenActivity.model";
import { TokenHolding } from "../models/tokenHolding.model";
import { User } from "../models/user.model";
import { ApiError } from "../utils/ApiError";
import type {
  FranchiseApplicationInput,
  ProfileInput,
} from "../validators/account.validator";

// ─── Perfil ──────────────────────────────────────────────────

export async function getProfile(userId: string) {
  const profile = await Profile.findOne({ where: { userId } });
  return profile ? profile.toContract() : null;
}

export async function saveProfile(userId: string, input: ProfileInput) {
  const [profile] = await Profile.findOrCreate({
    where: { userId },
    defaults: { userId, ...input },
  });
  profile.set(input);
  await profile.save();
  return profile.toContract();
}

// ─── Tenencias (solo lectura) ────────────────────────────────

export async function getHoldings(userId: string) {
  const holdings = await TokenHolding.findAll({
    where: { userId },
    include: [{ model: TokenActivity, as: "activities" }],
    order: [["createdAt", "ASC"]],
  });
  return holdings.map((h) => h.toContract());
}

// ─── Solicitudes de franquicia ───────────────────────────────

export async function getApplications(userId: string) {
  const applications = await FranchiseApplication.findAll({
    where: { userId },
    include: [{ model: FranchisePerformance, as: "performance" }],
    order: [["createdAt", "DESC"]],
  });
  return applications.map((a) => a.toContract());
}

export async function submitFranchise(
  userId: string,
  input: FranchiseApplicationInput,
) {
  // Crea solicitud + filas de rendimiento y limpia el borrador, de forma atómica.
  const application = await sequelize.transaction(async (tx) => {
    const created = await FranchiseApplication.create(
      {
        userId,
        franchiseName: input.franchiseName,
        sector: input.sector,
        city: input.city,
        country: input.country,
        totalCost: input.totalCost,
        currency: input.currency,
        description: input.description,
        operatorName: input.operatorName,
        estimatedOpening: input.estimatedOpening,
        performanceSource: input.performanceSource,
      },
      { transaction: tx },
    );

    const rows = [
      { year: input.year1, revenue: input.revenue1, marginPercent: input.margin1 },
      { year: input.year2, revenue: input.revenue2, marginPercent: input.margin2 },
      { year: input.year3, revenue: input.revenue3, marginPercent: input.margin3 },
    ];
    await FranchisePerformance.bulkCreate(
      rows.map((row) => ({ ...row, applicationId: created.id })),
      { transaction: tx },
    );

    await ApplicationDraft.destroy({ where: { userId }, transaction: tx });

    // Recarga con sus filas para serializar el contrato completo.
    const full = await FranchiseApplication.findByPk(created.id, {
      include: [{ model: FranchisePerformance, as: "performance" }],
      transaction: tx,
    });
    return full as FranchiseApplication;
  });

  return application.toContract();
}

// ─── Borrador del formulario ─────────────────────────────────

export async function getDraft(userId: string) {
  const draft = await ApplicationDraft.findOne({ where: { userId } });
  return draft ? draft.payload : null;
}

export async function saveDraft(userId: string, payload: unknown) {
  const [draft] = await ApplicationDraft.findOrCreate({
    where: { userId },
    defaults: { userId, payload },
  });
  draft.payload = payload;
  await draft.save();
  return draft.payload;
}

export async function clearDraft(userId: string) {
  await ApplicationDraft.destroy({ where: { userId } });
}

// ─── Wallet vinculada ────────────────────────────────────────

export async function linkWallet(user: User, walletAddress: string) {
  // Normaliza a checksum para almacenar/comparar de forma consistente.
  const checksummed = getAddress(walletAddress);
  const taken = await User.findOne({ where: { walletAddress: checksummed } });
  if (taken && taken.id !== user.id) {
    throw ApiError.conflict("Esa wallet ya está vinculada a otra cuenta.");
  }
  user.walletAddress = checksummed;
  await user.save();
  return { walletAddress: checksummed };
}

export function getWallet(user: User) {
  return { walletAddress: user.walletAddress ?? null };
}
