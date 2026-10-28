import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";
import { sequelize } from "../config/database";

export class User extends Model<
  InferAttributes<User>,
  InferCreationAttributes<User>
> {
  declare id: CreationOptional<string>;
  declare email: string;
  declare passwordHash: string;
  declare displayName: string;
  // Rol de aplicación. 'admin' habilita las operaciones de agente on-chain
  // (si además están habilitadas por configuración del servidor).
  declare role: CreationOptional<"investor" | "admin">;
  // Wallet EVM vinculada (checksum). Permite consultar tenencias on-chain.
  declare walletAddress: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(160),
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    displayName: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("investor", "admin"),
      allowNull: false,
      defaultValue: "investor",
    },
    walletAddress: {
      type: DataTypes.STRING(42),
      allowNull: true,
      unique: true,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "users",
    modelName: "User",
  },
);

/** Vista de sesión que consume el frontend (DemoSession). */
export function toSession(user: User) {
  return {
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
  };
}
