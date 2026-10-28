import { z } from "zod";

export const registerSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});

// Coincide con signInSchema del frontend (core/services/session.service.ts).
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
});

export const displayNameSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type DisplayNameInput = z.infer<typeof displayNameSchema>;
