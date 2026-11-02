import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";
import { sequelize } from "../config/database";

/**
 * Proyecto del marketplace (DemoProject). Catálogo público.
 * NOTA: solo la existencia de las marcas y sus programas de franquicia está
 * verificada; los escenarios de ROI son simulaciones, no ofertas reales.
 */
export class Project extends Model<
  InferAttributes<Project, { omit: "isOnChain" }>,
  InferCreationAttributes<Project, { omit: "isOnChain" }>
> {
  declare id: string; // slug estable usado en /marketplace/[slug]
  declare name: string;
  declare sector: string;
  declare format: string;
  declare descriptor: string;
  declare company: string;
  declare franchise: string;
  declare officialUrl: string;
  declare logoUrl: string | null;
  declare palette: "lime" | "peach" | "lavender" | "mint";
  declare annualizedRoiScenario: number[];
  declare featuredRank: CreationOptional<number>;
  // ── Capa de emisión/MVP ──
  // Estado del proyecto: publicada (admite compra) -> en_operacion (admite
  // distribuciones) -> cerrada (no admite compras).
  declare status: CreationOptional<"publicada" | "en_operacion" | "cerrada">;
  declare unitPriceMinor: CreationOptional<string>; // precio por token en unidades mínimas
  declare currency: CreationOptional<string>;
  declare currencyDecimals: CreationOptional<number>;
  declare tokenSymbol: CreationOptional<string | null>;
  declare tokenAddress: CreationOptional<string | null>;
  declare investmentAgreementAddress: CreationOptional<string | null>;
  declare totalUnits: CreationOptional<string | null>; // oferta total (null = sin tope)
  declare unitsSold: CreationOptional<string>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  /** true si la emisión se hace on-chain (proyecto cableado a C4). */
  get isOnChain(): boolean {
    return Boolean(this.investmentAgreementAddress && this.tokenAddress);
  }

  toContract() {
    const decimals = this.currencyDecimals;
    return {
      id: this.id,
      name: this.name,
      sector: this.sector,
      format: this.format,
      descriptor: this.descriptor,
      company: this.company,
      franchise: this.franchise,
      officialUrl: this.officialUrl,
      ...(this.logoUrl ? { logoUrl: this.logoUrl } : {}),
      palette: this.palette,
      annualizedRoiScenario: this.annualizedRoiScenario,
      // Capa MVP
      status: this.status,
      price: {
        minor: this.unitPriceMinor,
        currency: this.currency,
        decimals,
        display: majorStr(this.unitPriceMinor, decimals),
      },
      token: {
        symbol: this.tokenSymbol,
        address: this.tokenAddress,
        investmentAgreement: this.investmentAgreementAddress,
        onChain: this.isOnChain,
      },
      availability: {
        totalUnits: this.totalUnits,
        unitsSold: this.unitsSold,
        unitsAvailable:
          this.totalUnits === null
            ? null
            : (BigInt(this.totalUnits) - BigInt(this.unitsSold)).toString(),
      },
    };
  }
}

function majorStr(minorValue: string, decimals: number): string {
  const v = BigInt(minorValue);
  const abs = v.toString().padStart(decimals + 1, "0");
  const intPart = abs.slice(0, abs.length - decimals);
  const fracPart = decimals ? "." + abs.slice(abs.length - decimals) : "";
  return intPart + fracPart;
}

Project.init(
  {
    id: {
      type: DataTypes.STRING(80),
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(120), allowNull: false },
    sector: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    format: { type: DataTypes.STRING(120), allowNull: false },
    descriptor: { type: DataTypes.TEXT, allowNull: false },
    company: { type: DataTypes.TEXT, allowNull: false },
    franchise: { type: DataTypes.TEXT, allowNull: false },
    officialUrl: { type: DataTypes.STRING(500), allowNull: false },
    logoUrl: { type: DataTypes.STRING(500), allowNull: true },
    palette: {
      type: DataTypes.ENUM("lime", "peach", "lavender", "mint"),
      allowNull: false,
    },
    annualizedRoiScenario: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    // Orden "featured" del catálogo; menor = primero.
    featuredRank: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM("publicada", "en_operacion", "cerrada"),
      allowNull: false,
      defaultValue: "publicada",
    },
    unitPriceMinor: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: "1000", // USD 10 en centavos
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: "USD",
    },
    currencyDecimals: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2,
    },
    tokenSymbol: { type: DataTypes.STRING(40), allowNull: true },
    tokenAddress: { type: DataTypes.STRING(42), allowNull: true },
    investmentAgreementAddress: { type: DataTypes.STRING(42), allowNull: true },
    totalUnits: { type: DataTypes.STRING(40), allowNull: true },
    unitsSold: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: "0",
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "projects",
    modelName: "Project",
  },
);
