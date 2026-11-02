import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Falta la variable de entorno obligatoria: ${name}`);
  }
  return value;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === "true" || raw === "1";
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction: process.env.NODE_ENV === "production",
  port: int("PORT", 4000),
  corsOrigin: (process.env.CORS_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  db: {
    // "mysql" (local) o "postgres" (Supabase y otros). Si hay DATABASE_URL con
    // esquema postgres:// se infiere postgres salvo que se fije DB_DIALECT.
    dialect: (process.env.DB_DIALECT ??
      (/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "")
        ? "postgres"
        : "mysql")) as "mysql" | "postgres",
    // Cadena de conexión única (la que dan los hostings). Tiene prioridad sobre
    // los campos sueltos de abajo.
    url: process.env.DATABASE_URL ?? "",
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: int("DB_PORT", 3306),
    name: process.env.DB_NAME ?? "frantoken",
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    // SSL requerido por casi todos los hosts administrados (Supabase/Render).
    ssl: bool("DB_SSL", false),
    sync: bool("DB_SYNC", true),
    // Siembra datos demo al arrancar si faltan (útil en hosts sin "run command").
    seedOnBoot: bool("SEED_ON_BOOT", false),
    logging: bool("DB_LOGGING", false),
  },
  auth: {
    jwtSecret: required("JWT_SECRET", "dev-insecure-secret-change-me"),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
    bcryptRounds: int("BCRYPT_ROUNDS", 10),
  },
  blockchain: {
    // Habilita el módulo on-chain (lecturas). Sin esto, /api/blockchain responde 503.
    enabled: bool("BLOCKCHAIN_ENABLED", false),
    // Permite ejecutar operaciones de agente (mint, KYC, distribución, congelar...).
    // Requiere además una clave de agente y usuario con rol admin. Apagado por defecto.
    allowWrites: bool("BLOCKCHAIN_ALLOW_WRITES", false),
    rpcUrl: process.env.BLOCKCHAIN_RPC_URL ?? "",
    chainId: process.env.BLOCKCHAIN_CHAIN_ID
      ? int("BLOCKCHAIN_CHAIN_ID", 0)
      : undefined,
    // Clave privada del agente/firmante del servidor (solo para operaciones de escritura).
    agentPrivateKey: process.env.BLOCKCHAIN_AGENT_PRIVATE_KEY ?? "",
    manifestPath: process.env.BLOCKCHAIN_MANIFEST_PATH ?? "",
    useLocalAccounts: bool("BLOCKCHAIN_USE_LOCAL_ACCOUNTS", false),
    adminPrivateKey: process.env.BLOCKCHAIN_ADMIN_PRIVATE_KEY ?? "",
    verifierPrivateKey: process.env.BLOCKCHAIN_VERIFIER_PRIVATE_KEY ?? "",
    addresses: {
      franchiseToken: process.env.FRANCHISE_TOKEN_ADDRESS ?? "",
      identityRegistry: process.env.IDENTITY_REGISTRY_ADDRESS ?? "",
      compliance: process.env.FRANCHISE_COMPLIANCE_ADDRESS ?? "",
      paymentToken: process.env.PAYMENT_TOKEN_ADDRESS ?? "",
      // C4 — InvestmentAgreement (emisión mediante compra conciliada).
      investmentAgreement: process.env.INVESTMENT_AGREEMENT_ADDRESS ?? "",
    },
  },
} as const;
