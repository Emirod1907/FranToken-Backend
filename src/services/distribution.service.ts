import { Contract, EventLog, formatEther, parseUnits } from "ethers";
import {
  academicRuntime,
  academicSigner,
  chainWrite,
  projectContracts,
  erc20Abi,
} from "../blockchain/academic";
import { Distribution } from "../models/distribution.model";
import { Project } from "../models/project.model";
import { ApiError } from "../utils/ApiError";

export async function distribute(
  adminUserId: string,
  input: { projectId: string; periodId: string; amount: string; memo?: string },
) {
  const project = await Project.findByPk(input.projectId);
  if (!project) throw ApiError.notFound("Proyecto no encontrado.");
  const amount = parseUnits(input.amount, 6);
  if (amount <= 0n) throw ApiError.badRequest("Importe positivo requerido.");
  const period = Number(input.periodId.replace("-", ""));
  if (period < 200001 || period > 999912)
    throw ApiError.badRequest("Período inválido.");
  const { token, manifest } = await projectContracts(project);
  return chainWrite(async () => {
    const existing = await Distribution.findOne({
      where: { projectId: project.id, periodId: input.periodId },
    });
    if (!existing && Number(await token.projectStatus()) !== 2)
      throw ApiError.conflict("La franquicia debe estar en operación.");
    const [record] = await Distribution.findOrCreate({
      where: { projectId: project.id, periodId: input.periodId },
      defaults: {
        projectId: project.id,
        periodId: input.periodId,
        amountMinor: amount.toString(),
        currency: "mUSDC",
        memo: input.memo ?? null,
        totalUnits: (await token.totalSupply()).toString(),
        mode: "onchain",
        status: "pending",
        createdByUserId: adminUserId,
      },
    });
    if (record.amountMinor !== amount.toString())
      throw ApiError.conflict("El período ya tiene otro importe.");
    const recover = async () => {
      const logs = await token.queryFilter(
        token.filters.MonthlyRevenueDistributed(period),
        manifest.fromBlock,
      );
      const event = logs.find((e): e is EventLog => e instanceof EventLog);
      if (!event) return null;
      if (event.args.amount !== amount)
        throw ApiError.conflict(
          "La distribución en cadena tiene otro importe.",
        );
      const receipt = await event.getTransactionReceipt();
      await record.update({
        status: "confirmed",
        txHash: event.transactionHash,
        totalUnits: event.args.supplyAtDistribution.toString(),
      });
      return {
        distribution: record.toContract(),
        idempotent: true,
        txHash: event.transactionHash,
        gasFeeEth: formatEther(receipt.fee),
      };
    };
    const previous = await recover();
    if (previous) return previous;

    const signer = await academicSigner("admin");
    const writer = token.connect(signer) as Contract;
    if (Number(await token.projectStatus()) !== 2)
      throw ApiError.conflict("La franquicia debe estar en operación.");
    await academicRuntime(true);
    const pay = new Contract(manifest.paymentToken, erc20Abi, signer);
    let fee = 0n;
    try {
      const approval = await (
        await pay.approve(project.tokenAddress, amount)
      ).wait();
      fee = approval.fee;
      const tx = await writer.distributeMonthly(period, amount);
      await record.update({ txHash: tx.hash });
      const receipt = await tx.wait();
      const confirmed = await recover();
      if (!confirmed)
        throw ApiError.conflict(
          "Distribución pendiente de conciliación; reintentá el mismo mes e importe.",
        );
      return {
        ...confirmed,
        idempotent: false,
        txHash: tx.hash,
        gasFeeEth: formatEther(receipt.fee + fee),
      };
    } catch (error) {
      const result = await recover();
      if (result) return result;
      throw error;
    }
  });
}
export async function listDistributions(projectId: string) {
  return (
    await Distribution.findAll({
      where: { projectId },
      order: [["periodId", "DESC"]],
    })
  ).map((d) => d.toContract());
}
