import { Contract, JsonRpcProvider, Wallet, isAddress } from "ethers";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";
import {
  complianceAbi,
  erc20Abi,
  franchiseTokenAbi,
  identityRegistryAbi,
  investmentAgreementAbi,
} from "./abis";

// Instancias perezosas, memorizadas tras el primer uso.
let provider: JsonRpcProvider | null = null;
let signer: Wallet | null = null;

function ensureEnabled() {
  if (!env.blockchain.enabled) {
    throw new ApiError(503, "El módulo blockchain no está habilitado en el servidor.");
  }
  if (!env.blockchain.rpcUrl) {
    throw new ApiError(503, "Falta BLOCKCHAIN_RPC_URL en la configuración.");
  }
}

export function getProvider(): JsonRpcProvider {
  ensureEnabled();
  if (!provider) {
    provider = new JsonRpcProvider(
      env.blockchain.rpcUrl,
      env.blockchain.chainId,
    );
  }
  return provider;
}

/** Firmante del servidor (agente). Solo disponible con clave y escrituras habilitadas. */
export function getSigner(): Wallet {
  ensureEnabled();
  if (!env.blockchain.allowWrites) {
    throw ApiError.forbidden(
      "Las operaciones on-chain de escritura están deshabilitadas (BLOCKCHAIN_ALLOW_WRITES=false).",
    );
  }
  if (!env.blockchain.agentPrivateKey) {
    throw new ApiError(503, "Falta BLOCKCHAIN_AGENT_PRIVATE_KEY para firmar transacciones.");
  }
  if (!signer) {
    signer = new Wallet(env.blockchain.agentPrivateKey, getProvider());
  }
  return signer;
}

export function isWritingEnabled(): boolean {
  return (
    env.blockchain.enabled &&
    env.blockchain.allowWrites &&
    Boolean(env.blockchain.agentPrivateKey)
  );
}

function requireAddress(name: string, value: string): string {
  if (!value || !isAddress(value)) {
    throw new ApiError(503, `Dirección de contrato inválida o ausente: ${name}.`);
  }
  return value;
}

// ─── Contratos (conectados al provider para leer, al signer para escribir) ──

export function franchiseToken(write = false): Contract {
  // Resolver el runner primero valida que el módulo esté habilitado (503 claro).
  const runner = write ? getSigner() : getProvider();
  const address = requireAddress("FRANCHISE_TOKEN_ADDRESS", env.blockchain.addresses.franchiseToken);
  return new Contract(address, franchiseTokenAbi, runner);
}

export function identityRegistry(write = false): Contract {
  const runner = write ? getSigner() : getProvider();
  const address = requireAddress("IDENTITY_REGISTRY_ADDRESS", env.blockchain.addresses.identityRegistry);
  return new Contract(address, identityRegistryAbi, runner);
}

export function compliance(): Contract {
  const runner = getProvider();
  const address = requireAddress("FRANCHISE_COMPLIANCE_ADDRESS", env.blockchain.addresses.compliance);
  return new Contract(address, complianceAbi, runner);
}

export function paymentToken(write = false): Contract {
  const runner = write ? getSigner() : getProvider();
  const address = requireAddress("PAYMENT_TOKEN_ADDRESS", env.blockchain.addresses.paymentToken);
  return new Contract(address, erc20Abi, runner);
}

export function investmentAgreement(write = false): Contract {
  const runner = write ? getSigner() : getProvider();
  const address = requireAddress("INVESTMENT_AGREEMENT_ADDRESS", env.blockchain.addresses.investmentAgreement);
  return new Contract(address, investmentAgreementAbi, runner);
}

/** Normaliza y valida una dirección EVM; lanza 400 si es inválida. */
export function assertAddress(value: string, field = "address"): string {
  if (!isAddress(value)) {
    throw ApiError.badRequest(`La dirección '${field}' no es una dirección EVM válida.`);
  }
  return value;
}
