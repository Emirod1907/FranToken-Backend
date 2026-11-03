import type { Transaction } from "sequelize";
import { FranchiseAuditEvent } from "../models/franchiseAuditEvent.model";
import type { User } from "../models/user.model";

export function auditFranchise(
  actor: User,
  action: string,
  context: { applicationId?: string | null; projectId?: string | null },
  details: Record<string, unknown> = {},
  transaction?: Transaction,
) {
  return FranchiseAuditEvent.create(
    {
      ...context,
      actorUserId: actor.id,
      actorRole: actor.role,
      action,
      details,
    },
    { transaction },
  );
}
export async function franchiseHistory(
  context: { applicationId: string } | { projectId: string },
) {
  const rows = await FranchiseAuditEvent.findAll({
    where: context,
    order: [["createdAt", "DESC"]],
    limit: 100,
  });
  return rows.map((row) => row.toContract());
}
