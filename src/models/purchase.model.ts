import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";
import { sequelize } from "../config/database";

/**
 * Registro de intención y resultado de una emisión mediante C4
 * (InvestmentAgreement.issueAfterPayment). Da idempotencia económica y
 * trazabilidad del lado del backend: se persiste ANTES de enviar la transacción
 * y se recupera ante un reintento, en lugar de reemitir.
 *
 * `purchaseId` y `paymentReference` son referencias opacas (bytes32 hex), nunca
 * datos personales. Los importes se guardan como texto (unidades mínimas) para
 * no perder precisión.
 */
export class Purchase extends Model<
  InferAttributes<Purchase>,
  InferCreationAttributes<Purchase>
> {
  declare id: CreationOptional<string>;
  declare purchaseId: string;
  declare paymentReference: string;
  declare investorAddress: string;
  declare units: string;
  declare paidAmountMinor: string;
  declare evidenceHash: string;
  declare status: CreationOptional<"pending" | "confirmed" | "failed">;
  declare txHash: CreationOptional<string | null>;
  declare error: CreationOptional<string | null>;
  declare createdByUserId: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  toContract() {
    return {
      purchaseId: this.purchaseId,
      paymentReference: this.paymentReference,
      investorAddress: this.investorAddress,
      units: this.units,
      paidAmountMinor: this.paidAmountMinor,
      evidenceHash: this.evidenceHash,
      status: this.status,
      txHash: this.txHash,
    };
  }
}

Purchase.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    purchaseId: { type: DataTypes.STRING(66), allowNull: false, unique: true },
    paymentReference: { type: DataTypes.STRING(66), allowNull: false, unique: true },
    investorAddress: { type: DataTypes.STRING(42), allowNull: false },
    units: { type: DataTypes.STRING(80), allowNull: false },
    paidAmountMinor: { type: DataTypes.STRING(80), allowNull: false },
    evidenceHash: { type: DataTypes.STRING(66), allowNull: false },
    status: {
      type: DataTypes.ENUM("pending", "confirmed", "failed"),
      allowNull: false,
      defaultValue: "pending",
    },
    txHash: { type: DataTypes.STRING(66), allowNull: true },
    error: { type: DataTypes.TEXT, allowNull: true },
    createdByUserId: { type: DataTypes.UUID, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "purchases",
    modelName: "Purchase",
  },
);
