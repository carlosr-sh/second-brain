import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";

/**
 * Cloudflare Access JWT verification.
 *
 * Access sits in front of the hostname and, after a successful login, adds the
 * `Cf-Access-Jwt-Assertion` header to every request it forwards. We verify it
 * ourselves (defense in depth) so that a misconfigured route, a disabled Access
 * policy or a request reaching the Worker by another path is still rejected.
 *
 * Checks performed:
 *  - RS256 signature against the team's public keys (JWKS, rotated by Cloudflare)
 *  - `iss` == https://<team>.cloudflareaccess.com
 *  - `aud` contains this Access application's AUD tag
 *  - `exp` / `nbf` (with small clock tolerance)
 *  - token carries a user email (service tokens are rejected)
 */

export const ACCESS_JWT_HEADER = "cf-access-jwt-assertion";

export interface AccessIdentity {
  email: string;
  subject: string;
}

export type KeyResolverFactory = (teamDomain: string) => JWTVerifyGetKey;

// Module-level cache: jose's remote JWKS keeps keys in memory and refetches
// on unknown `kid` (key rotation) with a cooldown, so we reuse it per isolate.
const remoteJwksCache = new Map<string, JWTVerifyGetKey>();

export const remoteKeyResolver: KeyResolverFactory = (teamDomain) => {
  let jwks = remoteJwksCache.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`), {
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60_000,
    });
    remoteJwksCache.set(teamDomain, jwks);
  }
  return jwks;
};

export class AccessTokenError extends Error {
  constructor(readonly reason: string) {
    super(`Invalid Access token: ${reason}`);
    this.name = "AccessTokenError";
  }
}

interface AccessClaims extends JWTPayload {
  email?: unknown;
  type?: unknown;
}

export async function verifyAccessJwt(
  token: string,
  options: { teamDomain: string; audience: string; getKey: JWTVerifyGetKey },
): Promise<AccessIdentity> {
  let payload: AccessClaims;
  try {
    ({ payload } = await jwtVerify<AccessClaims>(token, options.getKey, {
      issuer: `https://${options.teamDomain}`,
      audience: options.audience,
      algorithms: ["RS256"],
      clockTolerance: 30,
      requiredClaims: ["exp", "iat", "sub"],
    }));
  } catch (err) {
    throw new AccessTokenError(describeJoseError(err));
  }

  if (payload.type !== undefined && payload.type !== "app") {
    throw new AccessTokenError(`unexpected token type '${String(payload.type)}'`);
  }
  if (typeof payload.email !== "string" || payload.email.length === 0) {
    throw new AccessTokenError("token has no user email (service tokens are not accepted)");
  }
  return { email: payload.email.toLowerCase(), subject: payload.sub ?? "" };
}

function describeJoseError(err: unknown): string {
  if (err instanceof errors.JWTExpired) return "expired";
  if (err instanceof errors.JWTClaimValidationFailed) return `claim '${err.claim}' ${err.reason}`;
  if (err instanceof errors.JWSSignatureVerificationFailed) return "bad signature";
  if (err instanceof errors.JOSEAlgNotAllowed) return "algorithm not allowed";
  if (err instanceof errors.JWKSNoMatchingKey) return "no matching key";
  if (err instanceof errors.JWSInvalid || err instanceof errors.JWTInvalid) return "malformed token";
  if (err instanceof Error) return err.name;
  return "unknown";
}
