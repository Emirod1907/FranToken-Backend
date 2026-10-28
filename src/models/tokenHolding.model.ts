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
import { TokenActivity } from "./tokenActivity.model";
import { User } from "./user.model";

/**
 * Tenencia de tokens de un usuario (TokenHolding). Representa posiciones.
 * NOTA DE NEGOCIO: en un sistema real, una fila aquí debe provenir de un
 * proceso de pago/emisión conciliado, nunca creada desde la UI. Este prototipo
 * las sirve como datos de solo lectura (sembradas o administradas).
 */
export class TokenHolding extends Model<
  InferAttributes<TokenHolding>,
  InferCreationAttributes<TokenHolding>
> {
  declare id: CreationOptional<string>;
  declare userId: ForeignKey<User["id"]>;
  declare projectName: string;
  declare symbol: string;
  declare quantity: number;
  declare currency: "USD";
  declare investedAmount: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare activities?: NonAttribute<TokenActivity[]>;

  toContract() {
    const activities = (this.activities ?? [])
      .slice()
      .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))
      .map((a) => a.toContract());
    return {
      id: this.id,
      projectName: this.projectName,
      symbol: this.symbol,
      quantity: this.quantity,
      currency: this.currency,
      investedAmount: this.investedAmount,
      activities,
    };
  }
}

TokenHolding.init(
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
    projectName: { type: DataTypes.STRING(120), allowNull: false },
    symbol: { type: DataTypes.STRING(40), allowNull: false },
    quantity: {
      type: DataTypes.DECIMAL(18, 4),
      allowNull: false,
      get(this: TokenHolding) {
        const raw = this.getDataValue("quantity") as unknown as string | null;
        return raw === null ? 0 : Number(raw);
      },
    },
    currency: {
      type: DataTypes.ENUM("USD"),
      allowNull: false,
      defaultValue: "USD",
    },
    investedAmount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      get(this: TokenHolding) {
        const raw = this.getDataValue("investedAmount") as unknown as string | null;
        return raw === null ? 0 : Number(raw);
      },
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "token_holdings",
    modelName: "TokenHolding",
  },
);
