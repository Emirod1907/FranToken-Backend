import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";
import { sequelize } from "../config/database";
import { FranchiseApplication } from "./franchiseApplication.model";

/** Fila de historial de rendimiento de una solicitud (year/revenue/margin). */
export class FranchisePerformance extends Model<
  InferAttributes<FranchisePerformance>,
  InferCreationAttributes<FranchisePerformance>
> {
  declare id: CreationOptional<string>;
  declare applicationId: ForeignKey<FranchiseApplication["id"]>;
  declare year: number;
  declare revenue: number;
  declare marginPercent: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

FranchisePerformance.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    applicationId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    revenue: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      get(this: FranchisePerformance) {
        const raw = this.getDataValue("revenue") as unknown as string | null;
        return raw === null ? 0 : Number(raw);
      },
    },
    // Porcentaje con escala documentada (2 decimales). Rango -100..100.
    marginPercent: {
      type: DataTypes.DECIMAL(7, 2),
      allowNull: false,
      get(this: FranchisePerformance) {
        const raw = this.getDataValue("marginPercent") as unknown as string | null;
        return raw === null ? 0 : Number(raw);
      },
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "franchise_performance",
    modelName: "FranchisePerformance",
  },
);
