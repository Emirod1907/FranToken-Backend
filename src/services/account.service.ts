import { randomUUID } from "crypto";
import { getAddress, verifyMessage } from "ethers";
import { sequelize } from "../config/database";
import { ApplicationDraft } from "../models/applicationDraft.model";
import { FranchiseApplication } from "../models/franchiseApplication.model";
import { FranchisePerformance } from "../models/franchisePerformance.model";
import { Profile } from "../models/profile.model";
import { TokenActivity } from "../models/tokenActivity.model";
import { TokenHolding } from "../models/tokenHolding.model";
import { User } from "../models/user.model";
import { WalletChallenge } from "../models/walletChallenge.model";
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

// ─── Wallet vinculada (con prueba de control) ────────────────

const CHALLENGE_TTL_MS = 10 * 60 * 1000;

function walletMessage(
  userId: string,
  address: string,
  nonce: string,
  expiresAt: Date,
): string {
  return (
    "FranToken: probá el control de tu wallet para vincularla.\n" +
    `Cuenta: ${userId}\n` +
    `Wallet: ${address}\n` +
    `Nonce: ${nonce}\n` +
    `Vence: ${expiresAt.toISOString()}`
  );
}

/**
 * #11 — Paso 1: emite un desafío. El usuario debe firmar el mensaje devuelto con
 * su wallet (personal_sign) para demostrar que la controla.
 */
export async function requestWalletChallenge(user: User, walletAddress: string) {
  const address = getAddress(walletAddress);
  const nonce = randomUUID();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
  const [challenge] = await WalletChallenge.findOrCreate({
    where: { userId: user.id },
    defaults: { userId: user.id, address, nonce, expiresAt },
  });
  challenge.set({ address, nonce, expiresAt });
  await challenge.save();
  return { message: walletMessage(user.id, address, nonce, expiresAt), expiresAt };
}

/**
 * #11 — Paso 2: verifica la firma del desafío antes de vincular. Sin firma válida
 * y vigente no se asocia la wallet (ya no se acepta una dirección sin prueba).
 */
export async function linkWallet(
  user: User,
  walletAddress: string,
  signature: string,
) {
  const address = getAddress(walletAddress);
  const challenge = await WalletChallenge.findOne({ where: { userId: user.id } });
  if (!challenge || challenge.address !== address) {
    throw ApiError.badRequest(
      "No hay un desafío vigente para esa wallet. Pedí uno nuevo primero.",
    );
  }
  if (challenge.expiresAt.getTime() < Date.now()) {
    throw ApiError.badRequest("El desafío venció. Pedí uno nuevo.");
  }

  const message = walletMessage(user.id, address, challenge.nonce, challenge.expiresAt);
  let recovered: string;
  try {
    recovered = getAddress(verifyMessage(message, signature));
  } catch {
    throw ApiError.badRequest("Firma inválida.");
  }
  if (recovered !== address) {
    throw ApiError.badRequest("La firma no corresponde a esa wallet.");
  }

  const taken = await User.findOne({ where: { walletAddress: address } });
  if (taken && taken.id !== user.id) {
    throw ApiError.conflict("Esa wallet ya está vinculada a otra cuenta.");
  }

  user.walletAddress = address;
  await user.save();
  await challenge.destroy();
  return { walletAddress: address };
}

export function getWallet(user: User) {
  return { walletAddress: user.walletAddress ?? null };
}
