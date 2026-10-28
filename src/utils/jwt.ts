import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

export type JwtPayload = {
  sub: string; // userId
  email: string;
};

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.auth.jwtSecret, {
    expiresIn: env.auth.jwtExpiresIn,
  } as SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.auth.jwtSecret);
  if (
    typeof decoded !== "object" ||
    decoded === null ||
    typeof (decoded as JwtPayload).sub !== "string"
  ) {
    throw new Error("Token inválido.");
  }
  return decoded as JwtPayload;
}
