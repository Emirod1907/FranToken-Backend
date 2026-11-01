import { randomBytes } from "crypto";
import { Op } from "sequelize";
import { investmentAgreementAt, isWritingEnabled } from "../blockchain/client";
import { Project } from "../models/project.model";
import { Purchase } from "../models/purchase.model";
import { RevenueAllocation } from "../models/revenueAllocation.model";
import { User } from "../models/user.model";
import { ApiError } from "../utils/ApiError";
import { grossMinor, toMajorNumber } from "../utils/money";

function ref(): string {
  return "0x" + randomBytes(32).toString("hex");
}

async function sendTx(txPromise: Promise<{ hash: string; wait: () => Promise<unknown> }>) {
  const tx = await txPromise;
  await tx.wait();
  return tx.hash;
}

/**
 * Compra de tokens de una franquicia. Pago SIMULADO (confirmado de prueba).
 * Si el proyecto está cableado a un token on-chain y las escrituras están
 * habilitadas, emite de verdad vía C4 (issueAfterPayment); si no, registra la
 * emisión en modo simulado para la demostración.
 */
export async function buyTokens(user: User, input: { projectId: string; units: number }) {
  const project = await Project.findByPk(input.projectId);
  if (!project) throw ApiError.notFound("Proyecto no encontrado.");
  if (project.status === "cerrada") {
    throw ApiError.conflict("La franquicia está cerrada; no admite compras.");
  }
  if (!user.kycApproved) {
    throw ApiError.forbidden("Tu cuenta no tiene el KYC habilitado para comprar.");
  }
  const units = input.units;
  if (!Number.isInteger(units) || units <= 0) {
    throw ApiError.badRequest("La cantidad debe ser un entero positivo.");
  }

  // Cupo (si el proyecto declara oferta total).
  if (project.totalUnits !== null) {
    const remaining = BigInt(project.totalUnits) - BigInt(project.unitsSold);
    if (BigInt(units) > remaining) {
      throw ApiError.conflict(`Sin cupo: quedan ${remaining.toString()} tokens.`);
    }
  }

  const paidAmountMinor = grossMinor(units, project.unitPriceMinor);
  const purchaseId = ref();
  const paymentReference = ref();
  const evidenceHash = ref(); // compromiso de la evidencia de pago (simulada)

  const onChain = project.isOnChain && isWritingEnabled();

  const purchase = await Purchase.create({
    purchaseId,
    paymentReference,
    evidenceHash,
    projectId: project.id,
    userId: user.id,
    investorAddress: user.walletAddress ?? null,
    units: String(units),
    unitPriceMinor: project.unitPriceMinor,
    paidAmountMinor,
    currency: project.currency,
    mode: onChain ? "onchain" : "simulated",
    status: "pending",
    createdByUserId: user.id,
  });

  if (onChain) {
    if (!user.walletAddress) {
      await purchase.update({ status: "failed", error: "Wallet no vinculada." });
      throw ApiError.badRequest(
        "Para comprar on-chain necesitás una wallet vinculada (PUT /api/account/wallet).",
      );
    }
    try {
      const agreement = investmentAgreementAt(project.investmentAgreementAddress as string, true);
      const txHash = await sendTx(
        agreement.issueAfterPayment(
          purchaseId,
          paymentReference,
          user.walletAddress,
          BigInt(units),
          BigInt(paidAmountMinor),
          evidenceHash,
        ),
      );
      await purchase.update({ status: "confirmed", txHash });
    } catch (err) {
      await purchase.update({
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  } else {
    await purchase.update({ status: "confirmed" });
  }

  // Actualiza cupo vendido.
  await project.update({
    unitsSold: (BigInt(project.unitsSold) + BigInt(units)).toString(),
  });

  return purchase.toContract();
}

export async function listPurchases(userId: string) {
  const purchases = await Purchase.findAll({
    where: { userId },
    order: [["createdAt", "DESC"]],
  });
  return purchases.map((p) => p.toContract());
}

/**
 * Tenencias del inversor, derivadas de compras confirmadas + asignaciones de
 * ingresos. Conserva la forma TokenHolding que espera el frontend y agrega
 * campos MVP (ingresos disponibles/cobrados).
 */
export async function getHoldings(userId: string) {
  const purchases = await Purchase.findAll({
    where: { userId, status: "confirmed" },
    order: [["createdAt", "DESC"]],
  });
  if (purchases.length === 0) return [];

  const projectIds = [...new Set(purchases.map((p) => p.projectId).filter(Boolean))] as string[];
  const projects = await Project.findAll({ where: { id: { [Op.in]: projectIds } } });
  const projectById = new Map(projects.map((p) => [p.id, p]));

  const allocations = await RevenueAllocation.findAll({
    where: { userId, projectId: { [Op.in]: projectIds } },
  });

  const holdings = projectIds.map((projectId) => {
    const project = projectById.get(projectId);
    const decimals = project?.currencyDecimals ?? 6;
    const currency = project?.currency ?? "USD";
    const rows = purchases.filter((p) => p.projectId === projectId);

    let units = 0n;
    let investedMinor = 0n;
    const activities = rows.map((p) => {
      units += BigInt(p.units);
      investedMinor += BigInt(p.paidAmountMinor);
      return {
        id: p.purchaseId.slice(0, 18),
        occurredAt: (p.createdAt ?? new Date()).toISOString().slice(0, 10),
        kind: "Compra",
        quantity: Number(p.units),
        unitPrice: toMajorNumber(p.unitPriceMinor ?? "0", decimals),
        amount: toMajorNumber(p.paidAmountMinor, decimals),
        currency,
        reference: p.purchaseId.slice(0, 10),
      };
    });

    const projAllocs = allocations.filter((a) => a.projectId === projectId);
    let availableMinor = 0n;
    let claimedMinor = 0n;
    for (const a of projAllocs) {
      if (a.claimed) claimedMinor += BigInt(a.amountMinor);
      else availableMinor += BigInt(a.amountMinor);
    }

    return {
      id: projectId,
      projectName: project?.name ?? projectId,
      symbol: project?.tokenSymbol ?? project?.name ?? projectId,
      quantity: Number(units),
      currency,
      investedAmount: toMajorNumber(investedMinor.toString(), decimals),
      // Campos MVP adicionales
      availableRevenue: toMajorNumber(availableMinor.toString(), decimals),
      claimedRevenue: toMajorNumber(claimedMinor.toString(), decimals),
      activities,
    };
  });

  return holdings;
}

/**
 * Cobro de ingresos (simulado): marca como cobradas las asignaciones pendientes
 * del inversor para un proyecto. En proyectos on-chain el cobro real lo hace el
 * inversor desde su wallet (claimRevenue); acá se informa el disponible.
 */
export async function claimRevenue(userId: string, projectId: string) {
  const project = await Project.findByPk(projectId);
  if (!project) throw ApiError.notFound("Proyecto no encontrado.");

  const pending = await RevenueAllocation.findAll({
    where: { userId, projectId, claimed: false },
  });
  const total = pending.reduce((acc, a) => acc + BigInt(a.amountMinor), 0n);

  if (total === 0n) {
    return {
      projectId,
      claimedMinor: "0",
      claimed: 0,
      currency: project.currency,
      note: project.isOnChain
        ? "En proyectos on-chain el cobro se hace desde tu wallet (claimRevenue)."
        : "No tenés ingresos pendientes.",
    };
  }

  const now = new Date();
  await RevenueAllocation.update(
    { claimed: true, claimedAt: now },
    { where: { userId, projectId, claimed: false } },
  );

  return {
    projectId,
    claimedMinor: total.toString(),
    claimed: toMajorNumber(total.toString(), project.currencyDecimals),
    currency: project.currency,
  };
}
