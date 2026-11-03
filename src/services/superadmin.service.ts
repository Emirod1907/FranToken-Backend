import { z } from "zod";
import { sequelize } from "../config/database";
import { User } from "../models/user.model";
import { ApiError } from "../utils/ApiError";
import { hashPassword } from "../utils/password";
import { auditFranchise } from "./franchiseAudit.service";

const bootstrapSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(12).max(200),
  displayName: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .default("Administración interna"),
});
export async function createSuperadmin(input: {
  email?: string;
  password?: string;
  displayName?: string;
}) {
  const parsed = bootstrapSchema.safeParse(input);
  if (!parsed.success)
    throw ApiError.badRequest(
      "Configurá SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD (mínimo 12 caracteres), y un nombre válido.",
    );
  const data = parsed.data;
  return sequelize.transaction(async (transaction) => {
    const existing = await User.findOne({
      where: { email: data.email },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (existing) {
      if (existing.role !== "superadmin")
        throw ApiError.conflict(
          "El correo ya pertenece a otra cuenta. No se modificó su rol ni su contraseña.",
        );
      return { created: false, userId: existing.id };
    }
    const user = await User.create(
      {
        email: data.email,
        passwordHash: await hashPassword(data.password),
        displayName: data.displayName,
        role: "superadmin",
      },
      { transaction },
    );
    await auditFranchise(user, "superadmin.created", {}, {}, transaction);
    return { created: true, userId: user.id };
  });
}
