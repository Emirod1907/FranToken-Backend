import { sequelize } from "../config/database";
import { ApplicationDraft } from "./applicationDraft.model";
import { FranchiseApplication } from "./franchiseApplication.model";
import { FranchisePerformance } from "./franchisePerformance.model";
import { Profile } from "./profile.model";
import { Project } from "./project.model";
import { TokenActivity } from "./tokenActivity.model";
import { TokenHolding } from "./tokenHolding.model";
import { User } from "./user.model";

// ─── Asociaciones ────────────────────────────────────────────

User.hasOne(Profile, { foreignKey: "userId", as: "profile", onDelete: "CASCADE" });
Profile.belongsTo(User, { foreignKey: "userId", as: "user" });

User.hasOne(ApplicationDraft, {
  foreignKey: "userId",
  as: "draft",
  onDelete: "CASCADE",
});
ApplicationDraft.belongsTo(User, { foreignKey: "userId", as: "user" });

User.hasMany(FranchiseApplication, {
  foreignKey: "userId",
  as: "applications",
  onDelete: "CASCADE",
});
FranchiseApplication.belongsTo(User, { foreignKey: "userId", as: "user" });

FranchiseApplication.hasMany(FranchisePerformance, {
  foreignKey: "applicationId",
  as: "performance",
  onDelete: "CASCADE",
});
FranchisePerformance.belongsTo(FranchiseApplication, {
  foreignKey: "applicationId",
  as: "application",
});

User.hasMany(TokenHolding, {
  foreignKey: "userId",
  as: "holdings",
  onDelete: "CASCADE",
});
TokenHolding.belongsTo(User, { foreignKey: "userId", as: "user" });

TokenHolding.hasMany(TokenActivity, {
  foreignKey: "holdingId",
  as: "activities",
  onDelete: "CASCADE",
});
TokenActivity.belongsTo(TokenHolding, { foreignKey: "holdingId", as: "holding" });

export {
  sequelize,
  User,
  Profile,
  ApplicationDraft,
  FranchiseApplication,
  FranchisePerformance,
  TokenHolding,
  TokenActivity,
  Project,
};

/**
 * Sincroniza el esquema (solo desarrollo). En producción, migraciones.
 */
export async function syncModels(): Promise<void> {
  await sequelize.sync({ alter: true });
}
