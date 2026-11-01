import { erc20At, franchiseTokenAt, isWritingEnabled } from "../blockchain/client";
import { sequelize } from "../config/database";
import { Distribution } from "../models/distribution.model";
import { Project } from "../models/project.model";
import { Purchase } from "../models/purchase.model";
import { RevenueAllocation } from "../models/revenueAllocation.model";
import { ApiError } from "../utils/ApiError";
import { majorToMinor, toMajorNumber } from "../utils/money";

async function sendTx(txPromise: Promise<{ hash: string; wait: () => Promise<unknown> }>) {
  const tx = await txPromise;
  await tx.wait();
  return tx.hash;
}

/** Suma de tokens por inversor (titulares) a partir de compras confirmadas. */
async function holdersSnapshot(projectId: string) {
  const purchases = await Purchase.findAll({
    where: { projectId, status: "confirmed" },
  });
  const byUser = new Map<string, bigint>();
  let total = 0n;
  for (const p of purchases) {
    if (!p.userId) continue;
    const u = BigInt(p.units);
    byUser.set(p.userId, (byUser.get(p.userId) ?? 0n) + u);
    total += u;
  }
  return { byUser, total };
}

/**
 * Registra una distribución de ingresos para un período (mensual). Solo si la
 * franquicia está "en_operacion". Idempotente por (projectId, periodId): un
 * reintento del mismo período devuelve la distribución previa sin repartir de
 * nuevo. Reparto proporcional a los tokens en circulación al ejecutarla.
 */
export async function distribute(
  adminUserId: string,
  input: { projectId: string; periodId: string; amount: string; memo?: string },
) {
  const project = await Project.findByPk(input.projectId);
  if (!project) throw ApiError.notFound("Proyecto no encontrado.");
  if (project.status !== "en_operacion") {
    throw ApiError.conflict(
      "La franquicia debe estar 'en_operacion' para registrar distribuciones.",
    );
  }

  // Idempotencia por período.
  const existing = await Distribution.findOne({
    where: { projectId: project.id, periodId: input.periodId },
  });
  if (existing && existing.status === "confirmed") {
    return { distribution: existing.toContract(), idempotent: true };
  }

  const amountMinor = majorToMinor(input.amount, project.currencyDecimals);
  if (BigInt(amountMinor) <= 0n) throw ApiError.badRequest("El importe debe ser positivo.");

  const { byUser, total } = await holdersSnapshot(project.id);
  if (total === 0n) throw ApiError.conflict("La franquicia no tiene titulares para repartir.");

  const onChain = project.isOnChain && isWritingEnabled();

  const result = await sequelize.transaction(async (tx) => {
    const distribution =
      existing ??
      (await Distribution.create(
        {
          projectId: project.id,
          periodId: input.periodId,
          amountMinor,
          currency: project.currency,
          memo: input.memo ?? null,
          totalUnits: total.toString(),
          mode: onChain ? "onchain" : "simulated",
          status: "pending",
          createdByUserId: adminUserId,
        },
        { transaction: tx },
      ));

    if (!onChain) {
      // Evita duplicar asignaciones si se reintenta un período no confirmado.
      await RevenueAllocation.destroy({
        where: { distributionId: distribution.id },
        transaction: tx,
      });
      // Reparto proporcional (floor); el polvo por redondeo queda sin asignar.
      const allocations = [...byUser.entries()].map(([userId, units]) => ({
        distributionId: distribution.id,
        projectId: project.id,
        userId,
        units: units.toString(),
        amountMinor: ((BigInt(amountMinor) * units) / total).toString(),
        currency: project.currency,
      }));
      await RevenueAllocation.bulkCreate(allocations, { transaction: tx });
    }

    await distribution.update(
      { mode: onChain ? "onchain" : "simulated", status: "pending" },
      { transaction: tx },
    );
    return distribution;
  });

  // Llamada on-chain fuera de la transacción de DB.
  if (onChain) {
    try {
      const token = franchiseTokenAt(project.tokenAddress as string, true);
      const payTokenAddress: string = await token.paymentToken();
      await sendTx(erc20At(payTokenAddress, true).approve(project.tokenAddress as string, BigInt(amountMinor)));
      const txHash = await sendTx(token.distributeRevenue(BigInt(amountMinor), input.memo ?? input.periodId));
      await result.update({ status: "confirmed", txHash });
    } catch (err) {
      await result.update({ status: "failed" });
      throw err;
    }
  } else {
    await result.update({ status: "confirmed" });
  }

  return { distribution: result.toContract(), idempotent: false };
}

export async function listDistributions(projectId: string) {
  const project = await Project.findByPk(projectId);
  const decimals = project?.currencyDecimals ?? 6;
  const rows = await Distribution.findAll({
    where: { projectId },
    order: [["periodId", "DESC"]],
  });
  return rows.map((d) => ({
    ...d.toContract(),
    amount: toMajorNumber(d.amountMinor, decimals),
  }));
}
