import "express";

// Augment Express's Request with the authenticated user attached by auth.middleware.
declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
    }
  }
}

export {};
