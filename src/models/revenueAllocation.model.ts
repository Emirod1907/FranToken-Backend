import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";
import { sequelize } from "../config/database";
import { Distribution } from "./distribution.model";

/**
 * Parte que le toca a un inversor de una distribución (modo simulado). En modo
 * on-chain el reparto lo lleva el contrato; estas filas son del circuito demo.
 * `claimed` registra el cobro (claimRevenue simulado).
 */
export class RevenueAllocation extends Model<
  InferAttributes<RevenueAllocation>,
  InferCreationAttributes<RevenueAllocation>
> {
  declare id: CreationOptional<string>;
  declare distributionId: ForeignKey<Distribution["id"]>;
  declare projectId: string;
  declare userId: string;
  declare units: string; // snapshot de tokens del inversor al momento del reparto
  declare amountMinor: string;
  declare currency: string;
  declare claimed: CreationOptional<boolean>;
  declare claimedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

RevenueAllocation.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    distributionId: { type: DataTypes.UUID, allowNull: false },
    projectId: { type: DataTypes.STRING(80), allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    units: { type: DataTypes.STRING(40), allowNull: false },
    amountMinor: { type: DataTypes.STRING(40), allowNull: false },
    currency: { type: DataTypes.STRING(3), allowNull: false },
    claimed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    claimedAt: { type: DataTypes.DATE, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "revenue_allocations",
    modelName: "RevenueAllocation",
  },
);
