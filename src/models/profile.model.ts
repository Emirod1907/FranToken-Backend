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
  declare dni: CreationOptional<string | null>;
  declare cuil: CreationOptional<string | null>;
  declare birthDate: CreationOptional<string | null>;
  declare province: CreationOptional<string | null>;
  declare city: CreationOptional<string | null>;
  declare address: CreationOptional<string | null>;
  declare postalCode: CreationOptional<string | null>;
  declare phone: string;
  declare country: string;
  declare investorUpdates: boolean;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  toContract() {
    return {
      fullName: this.fullName,
      dni: this.dni ?? "",
      cuil: this.cuil ?? "",
      birthDate: this.birthDate ?? "",
      province: this.province ?? "",
      city: this.city ?? "",
      address: this.address ?? "",
      postalCode: this.postalCode ?? "",
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
    dni: { type: DataTypes.STRING(12), allowNull: true },
    cuil: { type: DataTypes.STRING(11), allowNull: true },
    birthDate: { type: DataTypes.DATEONLY, allowNull: true },
    province: { type: DataTypes.STRING(100), allowNull: true },
    city: { type: DataTypes.STRING(100), allowNull: true },
    address: { type: DataTypes.STRING(200), allowNull: true },
    postalCode: { type: DataTypes.STRING(20), allowNull: true },
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
