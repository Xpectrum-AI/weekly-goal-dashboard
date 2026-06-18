import { initBaseAuth } from "@propelauth/node";

// ───────────────────────────────────────────────────────────────────────────
// PropelAuth server-side helpers.
//
// All configuration is read from environment variables:
//   NEXT_PUBLIC_PROPELAUTH_AUTH_URL   – your PropelAuth auth URL
//   PROPELAUTH_API_KEY                – backend API key (secret)
//   PROPELAUTH_VERIFIER_KEY           – RSA public key (for JWT verification)
// ───────────────────────────────────────────────────────────────────────────

let _auth: ReturnType<typeof initBaseAuth> | null = null;

function getAuth() {
  if (_auth) return _auth;
  const authUrl = process.env.NEXT_PUBLIC_PROPELAUTH_AUTH_URL;
  const apiKey = process.env.PROPELAUTH_API_KEY;
  // The verifier key is a PEM public key. When stored in .env it often contains
  // literal "\n" sequences instead of real newlines, which breaks PEM parsing.
  // Normalize them back to real newlines.
  const verifierKey = process.env.PROPELAUTH_VERIFIER_KEY?.replace(/\\n/g, "\n");

  if (!authUrl || !apiKey || !verifierKey) {
    throw new Error(
      "PropelAuth environment variables are not configured. Set NEXT_PUBLIC_PROPELAUTH_AUTH_URL, PROPELAUTH_API_KEY, and PROPELAUTH_VERIFIER_KEY."
    );
  }

  _auth = initBaseAuth({
    authUrl,
    apiKey,
    manualTokenVerificationMetadata: {
      verifierKey,
      issuer: authUrl,
    },
  });
  return _auth;
}

export { getAuth };

// ─── Token verification ─────────────────────────────────────────────────────

export interface AuthUser {
  userId: string;
  email: string;
}

/**
 * Verify the access token from a request's Authorization header.
 * Returns the authenticated user or null if invalid/missing.
 */
export async function verifyToken(request: Request): Promise<AuthUser | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  try {
    const auth = getAuth();
    const user = await auth.validateAccessTokenAndGetUser(authHeader);
    return { userId: user.userId, email: user.email };
  } catch {
    return null;
  }
}

/**
 * Extract the access token from cookies (for Next.js middleware / SSR).
 * PropelAuth stores the token in __pa_at cookie.
 */
export function getTokenFromCookies(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/__pa_at=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * Verify a token string directly (for middleware usage).
 */
export async function verifyTokenString(token: string): Promise<AuthUser | null> {
  try {
    const auth = getAuth();
    const user = await auth.validateAccessTokenAndGetUser(`Bearer ${token}`);
    return { userId: user.userId, email: user.email };
  } catch {
    return null;
  }
}

// ─── PropelAuth Management API helpers ──────────────────────────────────────

/**
 * Create (invite) a user through PropelAuth.
 * Returns the PropelAuth user ID.
 */
export async function inviteUser(email: string, name?: string): Promise<string> {
  const auth = getAuth();
  const result = await auth.createUser({
    email,
    emailConfirmed: false,
    sendEmailToConfirmEmailAddress: true,
    // Force a "set your password" step on first login. Without this, the
    // confirmation email only verifies the address and the user is left with
    // no credentials and no way to sign in.
    askUserToUpdatePasswordOnLogin: true,
    ...(name ? { firstName: name.split(" ")[0], lastName: name.split(" ").slice(1).join(" ") } : {}),
  });
  return result.userId;
}

/**
 * Disable a user in PropelAuth (prevents login).
 */
export async function disableUser(authUserId: string): Promise<void> {
  const auth = getAuth();
  await auth.disableUser(authUserId);
}

/**
 * Enable a previously disabled user in PropelAuth.
 */
export async function enableUser(authUserId: string): Promise<void> {
  const auth = getAuth();
  await auth.enableUser(authUserId);
}

/**
 * Permanently delete a user from PropelAuth.
 */
export async function deleteUser(authUserId: string): Promise<void> {
  const auth = getAuth();
  await auth.deleteUser(authUserId);
}

/**
 * Fetch user info from PropelAuth by user ID.
 */
export async function fetchUser(authUserId: string) {
  const auth = getAuth();
  return auth.fetchUserMetadataByUserId(authUserId, true);
}

/**
 * Check whether a user is a super-admin.
 *
 * Reads the authoritative `metadata.superadmin` flag from PropelAuth's
 * management API using the already-verified user ID. This is read entirely
 * server-side and cannot be forged by the client.
 */
export async function isSuperAdmin(authUserId: string): Promise<boolean> {
  try {
    const userMeta = await fetchUser(authUserId);
    // PropelAuth returns custom dashboard metadata under `metadata`.
    const metadata = (userMeta as { metadata?: Record<string, unknown> })?.metadata;
    // TEMP DIAGNOSTIC: log what PropelAuth actually returns for this user.
    console.error(
      `[isSuperAdmin] userId=${authUserId} metadata=${JSON.stringify(metadata)} ` +
        `props=${JSON.stringify(Object.keys((userMeta as object) ?? {}))}`
    );
    return metadata?.superadmin === true;
  } catch (e) {
    console.error(`[isSuperAdmin] fetchUser failed for ${authUserId}:`, e instanceof Error ? e.message : e);
    return false;
  }
}

/**
 * Send a "magic link" login email (acts as re-invite).
 *
 * NOTE: PropelAuth's createMagicLink only RETURNS a URL — it does not email it.
 * For actually re-sending an invite email, use resendInviteEmail().
 */
export async function createMagicLink(email: string, redirectUrl?: string) {
  const auth = getAuth();
  return auth.createMagicLink({
    email,
    redirectToUrl: redirectUrl,
  });
}

/**
 * Resolve the PropelAuth user id for an email, if an account exists.
 * Returns null when no account exists yet.
 */
export async function resolveAuthUserId(email: string): Promise<string | null> {
  const auth = getAuth();
  try {
    const meta = await auth.fetchUserMetadataByEmail(email, false);
    return (meta as { userId?: string } | null)?.userId ?? null;
  } catch {
    return null;
  }
}

/**
 * Re-send the PropelAuth invite/confirmation email to a user.
 *
 * Resolves the PropelAuth user id (from the stored authUserId, or by email),
 * then asks PropelAuth to actually deliver the confirmation email. Only works
 * for users who haven't confirmed their email yet.
 *
 * Returns true if PropelAuth sent the email; throws if no account is found.
 */
export async function resendInviteEmail(opts: { authUserId?: string; email: string }): Promise<boolean> {
  const auth = getAuth();
  let userId = opts.authUserId;
  if (!userId) {
    const meta = await auth.fetchUserMetadataByEmail(opts.email, false);
    userId = (meta as { userId?: string } | null)?.userId;
  }
  if (!userId) {
    throw new Error("No PropelAuth account exists for this email yet.");
  }
  return auth.resendEmailConfirmation(userId);
}
