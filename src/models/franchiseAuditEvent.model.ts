import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";
import { sequelize } from "../config/database";

export class FranchiseAuditEvent extends Model<
  InferAttributes<FranchiseAuditEvent>,
  InferCreationAttributes<FranchiseAuditEvent>
> {
  declare id: CreationOptional<string>;
  declare applicationId: CreationOptional<string | null>;
  declare projectId: CreationOptional<string | null>;
  declare actorUserId: string;
  declare actorRole: string;
  declare action: string;
  declare details: Record<string, unknown>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  toContract() {
    return {
      id: this.id,
      action: this.action,
      actorRole: this.actorRole,
      details: this.details,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
FranchiseAuditEvent.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    applicationId: { type: DataTypes.UUID, allowNull: true },
    projectId: { type: DataTypes.STRING(80), allowNull: true },
    actorUserId: { type: DataTypes.UUID, allowNull: false },
    actorRole: { type: DataTypes.STRING(20), allowNull: false },
    action: { type: DataTypes.STRING(80), allowNull: false },
    details: { type: DataTypes.JSON, allowNull: false },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "franchise_audit_events",
    modelName: "FranchiseAuditEvent",
    indexes: [{ fields: ["application_id"] }, { fields: ["project_id"] }],
  },
);
