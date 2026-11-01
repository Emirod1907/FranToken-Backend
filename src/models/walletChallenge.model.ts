import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";
import { sequelize } from "../config/database";
import { User } from "./user.model";

/**
 * Desafío para probar el control de una wallet antes de vincularla. El usuario
 * firma el mensaje con su wallet y el backend verifica la firma. Un nonce con
 * vencimiento evita reutilización. Una fila por usuario (se reemplaza).
 */
export class WalletChallenge extends Model<
  InferAttributes<WalletChallenge>,
  InferCreationAttributes<WalletChallenge>
> {
  declare id: CreationOptional<string>;
  declare userId: ForeignKey<User["id"]>;
  declare address: string;
  declare nonce: string;
  declare expiresAt: Date;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

WalletChallenge.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: { type: DataTypes.UUID, allowNull: false, unique: true },
    address: { type: DataTypes.STRING(42), allowNull: false },
    nonce: { type: DataTypes.STRING(80), allowNull: false },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "wallet_challenges",
    modelName: "WalletChallenge",
  },
);
