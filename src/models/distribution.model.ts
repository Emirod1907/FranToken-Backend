import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";
import { sequelize } from "../config/database";

/**
 * Distribución de ingresos de una franquicia para un período (mensual en el MVP).
 * Idempotente por (projectId, periodId): no se reparte dos veces el mismo período.
 * El reparto es proporcional a los tokens en circulación al ejecutarla.
 */
export class Distribution extends Model<
  InferAttributes<Distribution>,
  InferCreationAttributes<Distribution>
> {
  declare id: CreationOptional<string>;
  declare projectId: string;
  declare periodId: string; // ej. "2026-11"
  declare amountMinor: string;
  declare currency: string;
  declare memo: CreationOptional<string | null>;
  declare totalUnits: string; // snapshot del total en circulación
  declare mode: "simulated" | "onchain";
  declare status: CreationOptional<"pending" | "confirmed" | "failed">;
  declare txHash: CreationOptional<string | null>;
  declare createdByUserId: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  toContract() {
    return {
      id: this.id,
      projectId: this.projectId,
      periodId: this.periodId,
      amountMinor: this.amountMinor,
      currency: this.currency,
      currencyDecimals: 6,
      memo: this.memo,
      totalUnits: this.totalUnits,
      mode: this.mode,
      status: this.status,
      txHash: this.txHash,
      createdAt: this.createdAt?.toISOString?.() ?? null,
    };
  }
}

Distribution.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    projectId: { type: DataTypes.STRING(80), allowNull: false },
    periodId: { type: DataTypes.STRING(20), allowNull: false },
    amountMinor: { type: DataTypes.STRING(40), allowNull: false },
    currency: { type: DataTypes.STRING(12), allowNull: false },
    memo: { type: DataTypes.STRING(160), allowNull: true },
    totalUnits: { type: DataTypes.STRING(40), allowNull: false },
    mode: {
      type: DataTypes.ENUM("simulated", "onchain"),
      allowNull: false,
      defaultValue: "simulated",
    },
    status: {
      type: DataTypes.ENUM("pending", "confirmed", "failed"),
      allowNull: false,
      defaultValue: "pending",
    },
    txHash: { type: DataTypes.STRING(66), allowNull: true },
    createdByUserId: { type: DataTypes.UUID, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "distributions",
    modelName: "Distribution",
    indexes: [{ unique: true, fields: ["project_id", "period_id"] }],
  },
);
