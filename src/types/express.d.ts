import type { User } from "../models/user.model";

declare global {
  namespace Express {
    interface Request {
      // Usuario autenticado, poblado por authMiddleware.
      user?: User;
    }
  }
}

export {};
