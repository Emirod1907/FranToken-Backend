import { formatUnits, parseUnits } from "ethers";
import {
  assertAddress,
  compliance,
  franchiseToken,
  getProvider,
  identityRegistry,
  investmentAgreement,
  isWritingEnabled,
  paymentToken,
} from "../blockchain/client";
import { env } from "../config/env";
import { Purchase } from "../models/purchase.model";
import { ApiError } from "../utils/ApiError";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// ─── Helpers ─────────────────────────────────────────────────

type Amount = { raw: string; formatted: string; decimals: number };
function amount(raw: bigint, decimals: number): Amount {
  return { raw: raw.toString(), formatted: formatUnits(raw, decimals), decimals };
}

let tokenDecimalsCache: number | null = null;
async function tokenDecimals(): Promise<number> {
  if (tokenDecimalsCache === null) {
    tokenDecimalsCache = Number(await franchiseToken().decimals());
  }
  return tokenDecimalsCache;
}

let payDecimalsCache: number | null = null;
async function payDecimals(): Promise<number> {
  if (payDecimalsCache === null) {
    payDecimalsCache = env.blockchain.addresses.paymentToken
      ? Number(await paymentToken().decimals())
      : 18;
  }
  return payDecimalsCache;
}

// ─── Lecturas ────────────────────────────────────────────────

export async function getStatus() {
  const base = {
    enabled: env.blockchain.enabled,
    writesEnabled: isWritingEnabled(),
    addresses: env.blockchain.addresses,
  };
  if (!env.blockchain.enabled || !env.blockchain.rpcUrl) {
    return { ...base, network: null as null | { chainId: number; name: string } };
  }
  try {
    const network = await getProvider().getNetwork();
    return {
      ...base,
      network: { chainId: Number(network.chainId), name: network.name },
    };
  } catch {
    // Nodo inalcanzable: informamos la configuración igual.
    return { ...base, network: null as null | { chainId: number; name: string } };
  }
}

export async function getTokenInfo() {
  const token = franchiseToken();
  const [
    name,
    symbol,
    decimals,
    version,
    totalSupply,
    maxSupply,
    holderCount,
    paused,
    totalRevenueDistributed,
    pay,
    info,
  ] = await Promise.all([
    token.name(),
    token.symbol(),
    token.decimals(),
    token.version(),
    token.totalSupply(),
    token.maxSupply(),
    token.holderCount(),
    token.paused(),
    token.totalRevenueDistributed(),
    token.paymentToken(),
    token.franchiseInfo(),
  ]);

  const dec = Number(decimals);
  const payDec = await payDecimals();

  return {
    name,
    symbol,
    decimals: dec,
    version,
    paused,
    paymentToken: pay as string,
    totalSupply: amount(totalSupply, dec),
    maxSupply: maxSupply === 0n ? null : amount(maxSupply, dec),
    holderCount: Number(holderCount),
    totalRevenueDistributed: amount(totalRevenueDistributed, payDec),
    franchise: {
      franchiseName: info.franchiseName,
      brand: info.brand,
      location: info.location,
      legalDocumentURI: info.legalDocumentURI,
      legalDocumentHash: info.legalDocumentHash,
      valuation: amount(info.valuation, payDec),
    },
  };
}

export async function getComplianceInfo() {
  const c = compliance();
  const [maxHolders, maxBalancePerInvestor, lockupEnd, tokenBound] =
    await Promise.all([
      c.maxHolders(),
      c.maxBalancePerInvestor(),
      c.lockupEnd(),
      c.getTokenBound(),
    ]);
  const dec = await tokenDecimals();
  return {
    maxHolders: maxHolders === 0n ? null : Number(maxHolders),
    maxBalancePerInvestor:
      maxBalancePerInvestor === 0n ? null : amount(maxBalancePerInvestor, dec),
    lockupEnd: lockupEnd === 0n ? null : Number(lockupEnd),
    tokenBound: tokenBound as string,
  };
}

export async function getHolder(addressInput: string) {
  const address = assertAddress(addressInput, "address");
  const token = franchiseToken();
  const dec = await tokenDecimals();
  const payDec = await payDecimals();

  const [balance, frozen, frozenTokens, withdrawable, withdrawn] =
    await Promise.all([
      token.balanceOf(address),
      token.isFrozen(address),
      token.getFrozenTokens(address),
      token.withdrawableRevenueOf(address),
      token.withdrawnRevenueOf(address),
    ]);

  // Estado KYC EXPLÍCITO. Un fallo de consulta (RPC caído, registry mal
  // configurado) NO equivale a "no verificado": se informa como UNAVAILABLE,
  // para que quien decida sobre esa verificación pueda distinguirlo y bloquear.
  const kyc = await getKycStatus(address);

  return {
    address,
    balance: amount(balance, dec),
    frozen,
    frozenTokens: amount(frozenTokens, dec),
    revenue: {
      withdrawable: amount(withdrawable, payDec),
      withdrawn: amount(withdrawn, payDec),
    },
    kyc,
  };
}

export type KycStatus = "VERIFIED" | "NOT_REGISTERED" | "EXPIRED" | "UNAVAILABLE";

export async function getKycStatus(address: string): Promise<{
  status: KycStatus;
  verified: boolean | null;
  country: number | null;
  kycValidUntil: number | null;
  onchainIdentity: string | null;
}> {
  const registry = identityRegistry();
  try {
    const registered: boolean = await registry.contains(address);
    if (!registered) {
      return {
        status: "NOT_REGISTERED",
        verified: false,
        country: null,
        kycValidUntil: null,
        onchainIdentity: null,
      };
    }
    const [k, c, id] = await Promise.all([
      registry.kycValidUntil(address),
      registry.investorCountry(address),
      registry.identity(address),
    ]);
    const validUntil = Number(k);
    const nowSec = Math.floor(Date.now() / 1000);
    const expired = validUntil !== 0 && validUntil < nowSec;
    return {
      status: expired ? "EXPIRED" : "VERIFIED",
      verified: !expired,
      country: Number(c),
      kycValidUntil: validUntil === 0 ? null : validUntil,
      onchainIdentity: id as string,
    };
  } catch {
    // Indisponibilidad (RPC/registry): no se puede afirmar nada sobre el KYC.
    return {
      status: "UNAVAILABLE",
      verified: null,
      country: null,
      kycValidUntil: null,
      onchainIdentity: null,
    };
  }
}

// ─── Escrituras (agente) ─────────────────────────────────────

async function send(txPromise: Promise<{ hash: string; wait: () => Promise<unknown> }>) {
  const tx = await txPromise;
  await tx.wait();
  return tx.hash;
}

export async function registerIdentity(input: {
  address: string;
  identity: string;
  country: number;
}) {
  const address = assertAddress(input.address, "address");
  const identity = assertAddress(input.identity, "identity");
  const hash = await send(
    identityRegistry(true).registerIdentity(address, identity, input.country),
  );
  return { txHash: hash };
}

export async function mint(input: { address: string; amount: string }) {
  const address = assertAddress(input.address, "address");
  // #1 — Si hay un controlador de emisión (C4) configurado, el mint directo NO
  // es la vía válida: la emisión debe pasar por la compra conciliada. Avisamos
  // claramente en vez de dejar que la transacción revierta on-chain.
  const controller: string = await franchiseToken().issuanceController();
  if (controller && controller.toLowerCase() !== ZERO_ADDRESS) {
    throw ApiError.conflict(
      "La emisión está bajo el controlador C4 (InvestmentAgreement). Usá " +
        "POST /api/blockchain/subscriptions/issue (compra conciliada) en lugar del mint directo.",
    );
  }
  const value = parseUnits(input.amount, await tokenDecimals());
  const hash = await send(franchiseToken(true).mint(address, value));
  return { txHash: hash };
}

/**
 * #1/#3 — Emite participaciones mediante C4 (InvestmentAgreement.issueAfterPayment),
 * tras una compra conciliada por el verificador de pagos.
 *
 * Idempotente: persiste la intención ANTES de enviar la transacción y, ante un
 * reintento con el mismo purchaseId ya confirmado, devuelve el resultado previo
 * sin reemitir. El contrato además impone unicidad de purchaseId/paymentReference,
 * así que un reintento tras una respuesta perdida no duplica la emisión.
 *
 * Requisitos de despliegue: el firmante del servidor debe ser el `paymentVerifier`
 * del contrato y el token debe tener a este InvestmentAgreement como
 * `issuanceController`. `units` y `paidAmountMinor` son enteros (unidades del
 * token / unidades mínimas de la moneda).
 */
export async function issueSubscription(input: {
  purchaseId: string;
  paymentReference: string;
  investorAddress: string;
  units: string;
  paidAmountMinor: string;
  evidenceHash: string;
  createdByUserId?: string | null;
}) {
  const investor = assertAddress(input.investorAddress, "investorAddress");

  let record = await Purchase.findOne({ where: { purchaseId: input.purchaseId } });
  if (record && record.status === "confirmed") {
    return { purchase: record.toContract(), idempotent: true };
  }
  if (!record) {
    record = await Purchase.create({
      purchaseId: input.purchaseId,
      paymentReference: input.paymentReference,
      investorAddress: investor,
      units: input.units,
      paidAmountMinor: input.paidAmountMinor,
      evidenceHash: input.evidenceHash,
      status: "pending",
      createdByUserId: input.createdByUserId ?? null,
    });
  }

  try {
    const hash = await send(
      investmentAgreement(true).issueAfterPayment(
        input.purchaseId,
        input.paymentReference,
        investor,
        BigInt(input.units),
        BigInt(input.paidAmountMinor),
        input.evidenceHash,
      ),
    );
    record.status = "confirmed";
    record.txHash = hash;
    record.error = null;
    await record.save();
    return { purchase: record.toContract(), idempotent: false };
  } catch (err) {
    record.status = "failed";
    record.error = err instanceof Error ? err.message : String(err);
    await record.save();
    throw err;
  }
}

export async function setAddressFrozen(input: { address: string; frozen: boolean }) {
  const address = assertAddress(input.address, "address");
  const hash = await send(
    franchiseToken(true).setAddressFrozen(address, input.frozen),
  );
  return { txHash: hash };
}

export async function setPaused(paused: boolean) {
  const token = franchiseToken(true);
  const hash = await send(paused ? token.pause() : token.unpause());
  return { txHash: hash };
}

/**
 * Deposita ingresos para repartir entre holders. Hace `approve` del token de
 * pago y luego `distributeRevenue`. Revierte on-chain si alguna obligación
 * senior (regalías/honorarios) tiene pagos vencidos.
 */
export async function distributeRevenue(input: { amount: string; memo: string }) {
  const dec = await payDecimals();
  const value = parseUnits(input.amount, dec);
  const token = franchiseToken(true);
  const tokenAddress = await token.getAddress();

  const approveHash = await send(paymentToken(true).approve(tokenAddress, value));
  const distributeHash = await send(
    token.distributeRevenue(value, input.memo),
  );
  return { approveTxHash: approveHash, distributeTxHash: distributeHash };
}
