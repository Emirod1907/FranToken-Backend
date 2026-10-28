import { formatUnits, parseUnits } from "ethers";
import {
  assertAddress,
  compliance,
  franchiseToken,
  getProvider,
  identityRegistry,
  isWritingEnabled,
  paymentToken,
} from "../blockchain/client";
import { env } from "../config/env";

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
  const registry = identityRegistry();
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

  // El registro puede no tener la wallet: capturamos y devolvemos valores neutros.
  let verified = false;
  let country = 0;
  let kycValidUntil = 0;
  let onchainIdentity = "0x0000000000000000000000000000000000000000";
  try {
    const [v, c, k, id] = await Promise.all([
      registry.isVerified(address),
      registry.investorCountry(address),
      registry.kycValidUntil(address),
      registry.identity(address),
    ]);
    verified = v;
    country = Number(c);
    kycValidUntil = Number(k);
    onchainIdentity = id as string;
  } catch {
    // wallet no registrada
  }

  return {
    address,
    balance: amount(balance, dec),
    frozen,
    frozenTokens: amount(frozenTokens, dec),
    revenue: {
      withdrawable: amount(withdrawable, payDec),
      withdrawn: amount(withdrawn, payDec),
    },
    kyc: {
      verified,
      country,
      kycValidUntil: kycValidUntil === 0 ? null : kycValidUntil,
      onchainIdentity,
    },
  };
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
  const value = parseUnits(input.amount, await tokenDecimals());
  const hash = await send(franchiseToken(true).mint(address, value));
  return { txHash: hash };
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
