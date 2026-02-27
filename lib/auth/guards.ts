import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { AppRole, AuthContext } from "./types";

/**
 * Returns the current auth context (clerkUserId + role) or null if not signed in.
 * Role defaults to "viewer" if not set in publicMetadata.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const { userId, sessionClaims } = await auth();
  if (!userId) return null;
  const role: AppRole = sessionClaims?.publicMetadata?.role ?? "viewer";
  return { clerkUserId: userId, role };
}

/** Returns a 401 JSON response. */
export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** Returns a 403 JSON response. */
export function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * Guard: require a signed-in user (any role).
 * Returns a NextResponse error or null if the check passes.
 */
export async function requireSignedIn(): Promise<NextResponse | null> {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorizedResponse();
  return null;
}

/**
 * Guard: require admin role.
 * Returns a NextResponse error or null if the check passes.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorizedResponse();
  if (ctx.role !== "admin") return forbiddenResponse();
  return null;
}

/**
 * Guard: require editor or admin role.
 * Returns a NextResponse error or null if the check passes.
 */
export async function requireEditorOrAbove(): Promise<NextResponse | null> {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorizedResponse();
  if (ctx.role === "viewer") return forbiddenResponse();
  return null;
}

/** Role hierarchy helper. */
export function hasRole(userRole: AppRole, requiredRole: AppRole): boolean {
  const levels: Record<AppRole, number> = { viewer: 0, editor: 1, admin: 2 };
  return levels[userRole] >= levels[requiredRole];
}
