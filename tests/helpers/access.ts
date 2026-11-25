import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import type { KeyResolverFactory } from "../../src/worker/auth/access-jwt";

export const TEST_TEAM = "testteam.cloudflareaccess.com";
export const TEST_AUD = "test-audience-tag-0123456789abcdef";
export const OWNER = "owner@example.com";

/** Simulates a Cloudflare Access team: key pair + JWKS + token minting. */
export async function createFakeAccess() {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid: "test-key-1", alg: "RS256", use: "sig" };
  const jwks = createLocalJWKSet({ keys: [jwk] });
  const keyResolver: KeyResolverFactory = () => jwks;

  async function sign(
    claims: Record<string, unknown> = {},
    opts: { issuer?: string; audience?: string | string[]; expiresIn?: string | number; key?: CryptoKey; kid?: string } = {},
  ): Promise<string> {
    return new SignJWT({ email: OWNER, type: "app", ...claims })
      .setProtectedHeader({ alg: "RS256", kid: opts.kid ?? "test-key-1" })
      .setIssuer(opts.issuer ?? `https://${TEST_TEAM}`)
      .setAudience(opts.audience ?? [TEST_AUD])
      .setSubject("user-sub-123")
      .setIssuedAt()
      .setExpirationTime(opts.expiresIn ?? "10m")
      .sign(opts.key ?? privateKey);
  }

  return { keyResolver, jwks, sign };
}
