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

/** Perfil del inversor (UserProfile en el frontend). 1:1 con User. */
export class Profile extends Model<
  InferAttributes<Profile>,
  InferCreationAttributes<Profile>
> {
  declare id: CreationOptional<string>;
  declare userId: ForeignKey<User["id"]>;
  declare fullName: string;
  declare phone: string;
  declare country: string;
  declare investorUpdates: boolean;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  toContract() {
    return {
      fullName: this.fullName,
      phone: this.phone,
      country: this.country,
      investorUpdates: this.investorUpdates,
    };
  }
}

Profile.init(
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
    fullName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "",
    },
    country: {
      type: DataTypes.STRING(60),
      allowNull: false,
    },
    investorUpdates: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "profiles",
    modelName: "Profile",
  },
);
