export type AppRole = "admin" | "editor" | "viewer";

export interface AuthContext {
  clerkUserId: string;
  role: AppRole;
}

// Extend Clerk's session claims so publicMetadata.role is typed everywhere
declare global {
  interface CustomJwtSessionClaims {
    publicMetadata?: {
      role?: AppRole;
    };
  }
}
