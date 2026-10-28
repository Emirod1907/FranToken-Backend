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
 * Borrador del formulario de franquicia por usuario. El payload es opaco
 * (se guarda tal cual lo envía el frontend) porque es un estado de UI.
 */
export class ApplicationDraft extends Model<
  InferAttributes<ApplicationDraft>,
  InferCreationAttributes<ApplicationDraft>
> {
  declare id: CreationOptional<string>;
  declare userId: ForeignKey<User["id"]>;
  declare payload: unknown;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

ApplicationDraft.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "application_drafts",
    modelName: "ApplicationDraft",
  },
);
