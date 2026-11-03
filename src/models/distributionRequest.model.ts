import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";
import { formatUnits } from "ethers";
import { sequelize } from "../config/database";

export class DistributionRequest extends Model<
  InferAttributes<DistributionRequest>,
  InferCreationAttributes<DistributionRequest>
> {
  declare id: CreationOptional<string>;
  declare projectId: string;
  declare periodId: string;
  declare amountMinor: string;
  declare memo: CreationOptional<string>;
  declare status: CreationOptional<
    "pending" | "observed" | "executing" | "confirmed"
  >;
  declare version: CreationOptional<number>;
  declare createdByUserId: string;
  declare reviewedByUserId: CreationOptional<string | null>;
  declare reviewNote: CreationOptional<string>;
  declare distributionId: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  toContract() {
    return {
      id: this.id,
      projectId: this.projectId,
      periodId: this.periodId,
      amountMinor: this.amountMinor,
      amount: formatUnits(this.amountMinor, 6),
      currency: "mUSDC" as const,
      currencyDecimals: 6 as const,
      memo: this.memo,
      status: this.status,
      version: this.version,
      reviewNote: this.reviewNote,
      distributionId: this.distributionId,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}

DistributionRequest.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    projectId: { type: DataTypes.STRING(80), allowNull: false },
    periodId: { type: DataTypes.STRING(7), allowNull: false },
    amountMinor: { type: DataTypes.STRING(40), allowNull: false },
    memo: { type: DataTypes.STRING(160), allowNull: false, defaultValue: "" },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "pending",
    },
    version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    createdByUserId: { type: DataTypes.UUID, allowNull: false },
    reviewedByUserId: { type: DataTypes.UUID, allowNull: true },
    reviewNote: {
      type: DataTypes.STRING(500),
      allowNull: false,
      defaultValue: "",
    },
    distributionId: { type: DataTypes.UUID, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "distribution_requests",
    modelName: "DistributionRequest",
    indexes: [{ unique: true, fields: ["project_id", "period_id"] }],
  },
);
