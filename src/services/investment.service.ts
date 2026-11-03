import { Contract, EventLog, formatEther, getAddress, id } from "ethers";
import { Project } from "../models/project.model";
import { Purchase } from "../models/purchase.model";
import { User } from "../models/user.model";
import { ApiError } from "../utils/ApiError";
import {
  academicRuntime,
  academicSigner,
  chainWrite,
  onchainProject,
  projectContracts,
} from "../blockchain/academic";
import { requireCompleteProfile } from "./account.service";

export async function buyTokens(
  user: User,
  input: { projectId: string; units: string | number; requestId: string },
) {
  if (!user.walletAddress)
    throw ApiError.conflict(
      "Completá el perfil, vinculá tu wallet y solicitá habilitación manual antes de comprar.",
    );
  const walletAddress = user.walletAddress;
  const units = BigInt(input.units);
  if (units <= 0n || units > 1_000_000n)
    throw ApiError.badRequest("Cantidad inválida.");
  const project = await Project.findByPk(input.projectId);
  if (!project) throw ApiError.notFound("Proyecto no encontrado.");
  const { investment, manifest } = await projectContracts(project);
  const purchaseId = id(
    `${manifest.deploymentId}:${project.id}:${user.id}:${input.requestId}`,
  );
  const paymentReference = id(`payment:${purchaseId}`);
  return chainWrite(async () => {
    const [record] = await Purchase.findOrCreate({
      where: { purchaseId },
      defaults: {
        purchaseId,
        paymentReference,
        evidenceHash: id(`SIMULATED:${purchaseId}`),
        userId: user.id,
        createdByUserId: user.id,
        projectId: project.id,
        investorAddress: walletAddress,
        units: units.toString(),
        unitPriceMinor: "1000",
        paidAmountMinor: (units * 1000n).toString(),
        currency: "USD",
        mode: "onchain",
        status: "pending",
      },
    });
    if (
      record.userId !== user.id ||
      record.projectId !== project.id ||
      record.units !== units.toString() ||
      record.investorAddress?.toLowerCase() !== walletAddress.toLowerCase()
    )
      throw ApiError.conflict("Referencia de compra usada con otro contenido.");
    const recover = async () => {
      const logs = await investment.queryFilter(
        investment.filters.PurchaseIssued(purchaseId),
        manifest.fromBlock,
      );
      const event = logs.find((e): e is EventLog => e instanceof EventLog);
      if (!event) return null;
      if (
        getAddress(event.args.investor) !==
          getAddress(record.investorAddress!) ||
        event.args.units !== units
      )
        throw ApiError.conflict(
          "La emisión no coincide con la intención registrada.",
        );
      const receipt = await event.getTransactionReceipt();
      await record.update({
        status: "confirmed",
        txHash: event.transactionHash,
        error: null,
      });
      return {
        purchase: record.toContract(),
        txHash: event.transactionHash,
        gasFeeEth: formatEther(receipt.fee),
        recovered: true,
      };
    };
    const previous = await recover();
    if (previous) return previous;
    await requireCompleteProfile(user.id);
    if (!user.kycApproved)
      throw ApiError.conflict(
        "El administrador debe aprobar tu documentación antes de comprar.",
      );
    const { token } = await projectContracts(project);
    if (![1, 2].includes(Number(await token.projectStatus())))
      throw ApiError.conflict("La franquicia no admite compras.");
    if ((await investment.unitPriceMinor()) !== 1000n)
      throw ApiError.conflict("Precio C4 incompatible con USD 10 en centavos.");
    if (!(await investment.acceptedTerms(walletAddress)))
      throw ApiError.conflict(
        "Aceptá los términos desde tu wallet antes de comprar.",
      );
    const writer = investment.connect(
      await academicSigner("verifier"),
    ) as Contract;
    try {
      const tx = await writer.issueAfterPayment(
        purchaseId,
        paymentReference,
        walletAddress,
        units,
        units * 1000n,
        record.evidenceHash,
      );
      await record.update({ txHash: tx.hash, status: "pending" });
      const receipt = await tx.wait();
      await record.update({ status: "confirmed", error: null });
      return {
        purchase: record.toContract(),
        txHash: tx.hash,
        gasFeeEth: formatEther(receipt.fee),
        recovered: false,
      };
    } catch (error) {
      const result = await recover();
      if (result) return result;
      // Un timeout no prueba que la EVM haya rechazado: se conserva la misma referencia.
      await record.update({
        error:
          "Resultado pendiente de conciliación; reintentá la misma referencia.",
      });
      throw error;
    }
  });
}
export async function listPurchases(userId: string) {
  return (
    await Purchase.findAll({
      where: { userId },
      order: [["createdAt", "DESC"]],
    })
  ).map((p) => p.toContract());
}
export async function investmentSnapshot(user: User) {
  const { manifest } = await academicRuntime();
  const projects = await Project.findAll({ order: [["createdAt", "ASC"]] });
  const wired = projects.filter((p) => p.isOnChain);
  const registry = new Contract(
    manifest.registry,
    ["function isVerified(address) view returns(bool)"],
    (await academicRuntime()).provider,
  );
  return {
    deploymentId: manifest.deploymentId,
    chainId: 31337,
    admin: manifest.admin,
    isAdmin: user.role === "admin",
    wallet: user.walletAddress,
    verified: Boolean(
      user.kycApproved &&
        user.walletAddress &&
        (await registry.isVerified(user.walletAddress)),
    ),
    projects: await Promise.all(
      wired.map((p) => onchainProject(p, user.walletAddress)),
    ),
  };
}
export async function getHoldings(userId: string) {
  const user = await User.findByPk(userId);
  if (!user) throw ApiError.unauthorized();
  // Proyección compatible de lectura para las pantallas de cuenta anteriores.
  // El cap académico <= 1e6 garantiza enteros USD exactos y seguros en este DTO.
  // Ingresos de seis decimales e historial completo se sirven en /investment.
  return (await investmentSnapshot(user)).projects
    .filter((p) => BigInt(p.balance) > 0n)
    .map((p) => ({
      id: p.id,
      projectName: p.name,
      symbol: p.symbol,
      quantity: Number(p.balance),
      currency: "USD",
      investedAmount: Number(BigInt(p.balance) * 10n),
      activities: [],
    }));
}
export async function claimRevenue(userId: string, projectId: string) {
  const user = await User.findByPk(userId);
  const project = await Project.findByPk(projectId);
  if (!user?.walletAddress) throw ApiError.conflict("Vinculá tu wallet.");
  if (!project) throw ApiError.notFound("Proyecto no encontrado.");
  const { token } = await projectContracts(project);
  return {
    projectId,
    tokenAddress: project.tokenAddress,
    method: "claimRevenue",
    availableMinor: (
      await token.withdrawableRevenueOf(user.walletAddress)
    ).toString(),
    note: "El titular debe firmar claimRevenue desde su wallet. Esta consulta no paga ni marca ingresos cobrados.",
  };
}
