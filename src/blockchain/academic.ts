import { readFile } from "fs/promises";
import path from "path";
import {
  Contract,
  ContractFactory,
  EventLog,
  JsonRpcProvider,
  Wallet,
  getAddress,
  id,
  formatUnits,
} from "ethers";
import { z } from "zod";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";
import complianceArtifact from "./generated/compliance.json";
import { investmentAgreementAbi, identityRegistryAbi, erc20Abi } from "./abis";

export const academicTokenAbi = [
  "function name() view returns(string)",
  "function symbol() view returns(string)",
  "function totalSupply() view returns(uint256)",
  "function maxSupply() view returns(uint256)",
  "function projectStatus() view returns(uint8)",
  "function setProjectStatus(uint8)",
  "function balanceOf(address) view returns(uint256)",
  "function withdrawableRevenueOf(address) view returns(uint256)",
  "function withdrawnRevenueOf(address) view returns(uint256)",
  "function paused() view returns(bool)",
  "function isFrozen(address) view returns(bool)",
  "function paymentToken() view returns(address)",
  "function distributeMonthly(uint32,uint256)",
  "function distributedPeriod(uint32) view returns(bool)",
  "event MonthlyRevenueDistributed(uint32 indexed period,uint256 amount,uint256 supplyAtDistribution)",
  "event RevenueClaimed(address indexed holder,uint256 amount)",
];
const factoryAbi = [
  "function createProject(bytes32,string,string,uint256,address) returns(address,address)",
  "function projectToken(bytes32) view returns(address)",
  "function projectInvestment(bytes32) view returns(address)",
  "event ProjectCreated(bytes32 indexed key,address token,address investment)",
];
const address = z.string().regex(/^0x[\da-fA-F]{40}$/);
const manifestSchema = z.object({
  version: z.literal(1),
  deploymentId: z.string().uuid(),
  chainId: z.literal(31337),
  fromBlock: z.number().int().nonnegative(),
  admin: address,
  verifier: address,
  registry: address,
  paymentToken: address,
  factory: address.optional(),
  projects: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      token: address,
      investment: address,
    }),
  ),
});
let provider: JsonRpcProvider | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();
export function chainWrite<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(fn, fn);
  writeQueue = next.catch(() => undefined);
  return next;
}
export async function academicRuntime(write = false) {
  if (!env.blockchain.enabled || (write && !env.blockchain.allowWrites))
    throw new ApiError(
      503,
      "Blockchain no disponible. No se confirmó ninguna emisión simulada en BD.",
    );
  const manifest = manifestSchema.parse(
    JSON.parse(
      await readFile(
        env.blockchain.manifestPath ||
          path.resolve(
            process.cwd(),
            "../FranToken_Blockchain/deployments/academic-local.json",
          ),
        "utf8",
      ),
    ),
  );
  const rpc = env.blockchain.rpcUrl;
  if (!rpc) throw new ApiError(503, "Falta BLOCKCHAIN_RPC_URL.");
  provider ??= new JsonRpcProvider(rpc, undefined, { cacheTimeout: -1 });
  if ((await provider.getNetwork()).chainId !== 31337n)
    throw new ApiError(503, "El MVP requiere Hardhat local (31337).");
  if ((await provider.getCode(manifest.registry)) === "0x")
    throw new ApiError(
      503,
      "Manifiesto sin despliegue vigente. Redesplegá la demo.",
    );
  return { manifest, provider };
}
export async function academicSigner(kind: "admin" | "verifier") {
  const { manifest, provider } = await academicRuntime(true);
  const expected = kind === "admin" ? manifest.admin : manifest.verifier;
  const key =
    kind === "admin"
      ? env.blockchain.adminPrivateKey
      : env.blockchain.verifierPrivateKey;
  const rpc = new URL(env.blockchain.rpcUrl);
  const signer = key
    ? new Wallet(key, provider)
    : env.blockchain.useLocalAccounts &&
        ["localhost", "127.0.0.1", "[::1]"].includes(rpc.hostname)
      ? await provider.getSigner(expected)
      : null;
  if (!signer || getAddress(await signer.getAddress()) !== getAddress(expected))
    throw new ApiError(503, `Configurá el firmante ${kind} del manifiesto.`);
  return signer;
}
export async function projectContracts(project: {
  tokenAddress: string | null;
  investmentAgreementAddress: string | null;
}) {
  if (!project.tokenAddress || !project.investmentAgreementAddress)
    throw new ApiError(409, "Proyecto sin emisión publicada.");
  const { provider, manifest } = await academicRuntime();
  return {
    provider,
    manifest,
    token: new Contract(project.tokenAddress, academicTokenAbi, provider),
    investment: new Contract(
      project.investmentAgreementAddress,
      investmentAgreementAbi,
      provider,
    ),
  };
}
export async function approveWallet(wallet: string, approved: boolean) {
  return chainWrite(async () => {
    const { manifest } = await academicRuntime(true);
    const signer = await academicSigner("admin");
    const registry = new Contract(
      manifest.registry,
      identityRegistryAbi,
      signer,
    );
    if (approved) {
      if (!(await registry.contains(wallet)))
        await (await registry.registerIdentity(wallet, wallet, 32)).wait();
      else await (await registry.setKycExpiration(wallet, 0)).wait();
    } else if (await registry.contains(wallet))
      await (await registry.deleteIdentity(wallet)).wait();
  });
}
export async function publishContract(
  projectId: string,
  name: string,
  symbol: string,
  supply: string,
) {
  return chainWrite(async () => {
    const { manifest } = await academicRuntime(true);
    if (!manifest.factory)
      throw new ApiError(
        503,
        "Redesplegá con la fábrica académica actualizada.",
      );
    const signer = await academicSigner("admin");
    const factory = new Contract(manifest.factory, factoryAbi, signer);
    const key = id(projectId);
    if (
      (await factory.projectToken(key)) ===
      "0x0000000000000000000000000000000000000000"
    ) {
      const compliance = await new ContractFactory(
        complianceArtifact.abi,
        complianceArtifact.bytecode,
        signer,
      ).deploy(manifest.admin);
      await compliance.waitForDeployment();
      try {
        await (
          await factory.createProject(
            key,
            name,
            symbol,
            BigInt(supply),
            await compliance.getAddress(),
          )
        ).wait();
      } catch (error) {
        if (
          (await factory.projectToken(key)) ===
          "0x0000000000000000000000000000000000000000"
        )
          throw error;
      }
    }
    const tokenAddress: string = await factory.projectToken(key);
    const investmentAgreementAddress: string =
      await factory.projectInvestment(key);
    const token = new Contract(tokenAddress, academicTokenAbi, signer);
    if (
      (await token.name()) !== name ||
      (await token.symbol()) !== symbol ||
      (await token.maxSupply()) !== BigInt(supply)
    )
      throw ApiError.conflict(
        "La publicación ya existe con otra configuración.",
      );
    return { tokenAddress, investmentAgreementAddress };
  });
}
export async function onchainProject(
  project: {
    id: string;
    name: string;
    tokenAddress: string | null;
    investmentAgreementAddress: string | null;
  },
  wallet: string | null,
) {
  const { token, investment, manifest } = await projectContracts(project);
  const [
    symbol,
    status,
    supply,
    max,
    paused,
    balance,
    withdrawable,
    withdrawn,
    accepted,
    frozen,
  ] = await Promise.all([
    token.symbol(),
    token.projectStatus(),
    token.totalSupply(),
    token.maxSupply(),
    token.paused(),
    wallet ? token.balanceOf(wallet) : 0n,
    wallet ? token.withdrawableRevenueOf(wallet) : 0n,
    wallet ? token.withdrawnRevenueOf(wallet) : 0n,
    wallet ? investment.acceptedTerms(wallet) : false,
    wallet ? token.isFrozen(wallet) : false,
  ]);
  const [purchases, distributions, claims] = await Promise.all([
    wallet
      ? investment.queryFilter(
          investment.filters.PurchaseIssued(null, wallet),
          manifest.fromBlock,
        )
      : [],
    token.queryFilter(
      token.filters.MonthlyRevenueDistributed(),
      manifest.fromBlock,
    ),
    wallet
      ? token.queryFilter(
          token.filters.RevenueClaimed(wallet),
          manifest.fromBlock,
        )
      : [],
  ]);
  return {
    id: project.id,
    name: project.name,
    token: project.tokenAddress!,
    investment: project.investmentAgreementAddress!,
    symbol,
    status: Number(status),
    supply: supply.toString(),
    available: (max - supply).toString(),
    paused,
    balance: balance.toString(),
    withdrawable: formatUnits(withdrawable, 6),
    withdrawn: formatUnits(withdrawn, 6),
    accepted,
    frozen,
    purchases: purchases.flatMap((e) =>
      e instanceof EventLog
        ? [
            {
              kind: "Compra simulada",
              reference: e.args.purchaseId,
              amount: e.args.units.toString(),
              txHash: e.transactionHash,
            },
          ]
        : [],
    ),
    distributions: distributions.flatMap((e) =>
      e instanceof EventLog
        ? [
            {
              kind: "Distribución",
              reference: e.args.period.toString(),
              period: e.args.period.toString(),
              amount: formatUnits(e.args.amount, 6),
              txHash: e.transactionHash,
            },
          ]
        : [],
    ),
    claims: claims.flatMap((e) =>
      e instanceof EventLog
        ? [
            {
              kind: "Cobro",
              reference: e.transactionHash,
              amount: formatUnits(e.args.amount, 6),
              txHash: e.transactionHash,
            },
          ]
        : [],
    ),
  };
}
export { erc20Abi };
