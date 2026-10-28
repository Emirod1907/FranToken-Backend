import { User, toSession } from "../models/user.model";
import { ApiError } from "../utils/ApiError";
import { signToken } from "../utils/jwt";
import { hashPassword, verifyPassword } from "../utils/password";
import type {
  LoginInput,
  RegisterInput,
} from "../validators/auth.validator";

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
  if (!user) throw invalid;
  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) throw invalid;
  return issue(user);
}

export async function updateDisplayName(user: User, displayName: string) {
  user.displayName = displayName;
  await user.save();
  return toSession(user);
}
