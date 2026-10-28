import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";
import { sequelize } from "../config/database";
import { TokenHolding } from "./tokenHolding.model";

/** Movimiento asociado a una tenencia (TokenActivity). */
export class TokenActivity extends Model<
  InferAttributes<TokenActivity>,
  InferCreationAttributes<TokenActivity>
> {
  declare id: CreationOptional<string>;
  declare holdingId: ForeignKey<TokenHolding["id"]>;
  declare occurredAt: string; // fecha ISO (YYYY-MM-DD)
  declare kind: "Compra de ejemplo" | "Nota de proyecto";
  declare quantity: number | null;
  declare unitPrice: number | null;
  declare amount: number | null;
  declare currency: "USD";
  declare reference: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  toContract() {
    return {
      id: this.id,
      occurredAt: this.occurredAt,
      kind: this.kind,
      quantity: this.quantity,
      unitPrice: this.unitPrice,
      amount: this.amount,
      currency: this.currency,
      reference: this.reference,
    };
  }
}

function nullableDecimal(field: "quantity" | "unitPrice" | "amount") {
  return function (this: TokenActivity) {
    const raw = this.getDataValue(field) as unknown as string | null;
    return raw === null ? null : Number(raw);
  };
}

TokenActivity.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    holdingId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    occurredAt: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    kind: {
      type: DataTypes.ENUM("Compra de ejemplo", "Nota de proyecto"),
      allowNull: false,
    },
    // null = no disponible (no 0). Se conserva la distinción del modelo.
    quantity: {
      type: DataTypes.DECIMAL(18, 4),
      allowNull: true,
      get: nullableDecimal("quantity"),
    },
    unitPrice: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true,
      get: nullableDecimal("unitPrice"),
    },
    amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true,
      get: nullableDecimal("amount"),
    },
    currency: {
      type: DataTypes.ENUM("USD"),
      allowNull: false,
      defaultValue: "USD",
    },
    reference: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "token_activities",
    modelName: "TokenActivity",
  },
);
