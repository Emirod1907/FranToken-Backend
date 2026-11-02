import { env } from "../config/env";
import { User, toSession } from "../models/user.model";
import { ApiError } from "../utils/ApiError";
import { signToken } from "../utils/jwt";
import { hashPassword, verifyPassword } from "../utils/password";
import type {
  LoginInput,
  RegisterInput,
} from "../validators/auth.validator";

// Nombre visible razonable a partir del correo (para el alta automática).
function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0]?.replace(/[._-]/g, " ").trim();
  return local && local.length >= 2 ? local : "Inversor";
}

function issue(user: User) {
  const session = toSession(user);
  const token = signToken({ sub: user.id, email: user.email });
  return { token, session };
}

export async function register(input: RegisterInput) {
  const existing = await User.findOne({ where: { email: input.email } });
  if (existing) {
    throw ApiError.conflict("Ya existe una cuenta con ese correo.");
  }
  const user = await User.create({
    email: input.email,
    displayName: input.displayName,
    passwordHash: await hashPassword(input.password),
  });
  return issue(user);
}

export async function login(input: LoginInput) {
  const user = await User.findOne({ where: { email: input.email } });
  // Mensaje genérico para no revelar si el correo existe.
  const invalid = ApiError.unauthorized("Correo o contraseña incorrectos.");

  if (!user) {
    // Demo sin página de registro: el primer login crea la cuenta y autentica.
    if (env.auth.autoRegisterOnLogin) return registerFromLogin(input);
    throw invalid;
  }

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) throw invalid;
  return issue(user);
}

// Alta implícita en el primer login (solo con AUTH_AUTO_REGISTER=true). KYC
// aprobado para que la cuenta pueda usar el circuito demo sin flujo de KYC.
async function registerFromLogin(input: LoginInput) {
  try {
    const user = await User.create({
      email: input.email,
      displayName: displayNameFromEmail(input.email),
      passwordHash: await hashPassword(input.password),
      kycApproved: true,
    });
    return issue(user);
  } catch {
    // Carrera: otro request creó el usuario entre el findOne y el create.
    const user = await User.findOne({ where: { email: input.email } });
    if (user && (await verifyPassword(input.password, user.passwordHash))) {
      return issue(user);
    }
    throw ApiError.unauthorized("Correo o contraseña incorrectos.");
  }
}

export async function updateDisplayName(user: User, displayName: string) {
  user.displayName = displayName;
  await user.save();
  return toSession(user);
}
