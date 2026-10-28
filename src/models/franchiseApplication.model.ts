import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
} from "sequelize";
import { sequelize } from "../config/database";
import { FranchisePerformance } from "./franchisePerformance.model";
import { User } from "./user.model";

// Estado único soportado hoy. El circuito de revisión real está pendiente
// (ver docs del frontend: "Borrador demo enviado" no es una entrega formal).
export const APPLICATION_STATUS = "Borrador demo enviado" as const;

/** Solicitud para abrir una franquicia (FranchiseApplication). 1:N por usuario. */
export class FranchiseApplication extends Model<
  InferAttributes<FranchiseApplication>,
  InferCreationAttributes<FranchiseApplication>
> {
  declare id: CreationOptional<string>;
  declare userId: ForeignKey<User["id"]>;
  declare status: CreationOptional<string>;
  declare franchiseName: string;
  declare sector: string;
  declare city: string;
  declare country: string;
  declare totalCost: number;
  declare currency: "USD" | "ARS";
  declare description: string;
  declare operatorName: string;
  declare estimatedOpening: string;
  declare performanceSource: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare performance?: NonAttribute<FranchisePerformance[]>;

  /** Serializa al contrato que espera el frontend (FranchiseApplication). */
  toContract() {
    const rows = (this.performance ?? [])
      .slice()
      .sort((a, b) => a.year - b.year)
      .map((row) => ({
        year: row.year,
        revenue: row.revenue,
        marginPercent: row.marginPercent,
      }));
    return {
      id: this.id,
      createdAt: this.createdAt.toISOString(),
      status: this.status,
      franchiseName: this.franchiseName,
      sector: this.sector,
      city: this.city,
      country: this.country,
      totalCost: this.totalCost,
      currency: this.currency,
      description: this.description,
      operatorName: this.operatorName,
      estimatedOpening: this.estimatedOpening,
      performanceSource: this.performanceSource,
      performance: rows,
    };
  }
}

FranchiseApplication.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(60),
      allowNull: false,
      defaultValue: APPLICATION_STATUS,
    },
    franchiseName: { type: DataTypes.STRING(100), allowNull: false },
    sector: { type: DataTypes.STRING(80), allowNull: false },
    city: { type: DataTypes.STRING(80), allowNull: false },
    country: { type: DataTypes.STRING(80), allowNull: false },
    // Importe: DECIMAL para no perder precisión. Getter devuelve número.
    totalCost: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      get(this: FranchiseApplication) {
        const raw = this.getDataValue("totalCost") as unknown as string | null;
        return raw === null ? 0 : Number(raw);
      },
    },
    currency: {
      type: DataTypes.ENUM("USD", "ARS"),
      allowNull: false,
    },
    description: { type: DataTypes.TEXT, allowNull: false },
    operatorName: { type: DataTypes.STRING(120), allowNull: false },
    estimatedOpening: { type: DataTypes.STRING(20), allowNull: false },
    performanceSource: { type: DataTypes.STRING(255), allowNull: false },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "franchise_applications",
    modelName: "FranchiseApplication",
  },
);
