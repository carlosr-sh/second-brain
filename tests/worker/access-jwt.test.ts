import { generateKeyPair, SignJWT, UnsecuredJWT } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { AccessTokenError, verifyAccessJwt } from "../../src/worker/auth/access-jwt";
import { createFakeAccess, OWNER, TEST_AUD, TEST_TEAM } from "../helpers/access";

describe("verifyAccessJwt", () => {
  let fake: Awaited<ReturnType<typeof createFakeAccess>>;
  const verify = (token: string) =>
    verifyAccessJwt(token, { teamDomain: TEST_TEAM, audience: TEST_AUD, getKey: fake.jwks });

  beforeAll(async () => {
    fake = await createFakeAccess();
  });

  it("accepts a valid token and normalizes the email", async () => {
    const token = await fake.sign({ email: "Owner@Example.com" });
    await expect(verify(token)).resolves.toEqual({ email: OWNER, subject: "user-sub-123" });
  });

  const rejects = async (token: string, reason: RegExp) => {
    const err = await verify(token).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AccessTokenError);
    expect((err as AccessTokenError).reason).toMatch(reason);
  };

  it("rejects a token for another Access application (aud)", async () => {
    await rejects(await fake.sign({}, { audience: "other-app-aud" }), /aud/);
  });

  it("rejects a token from another team (iss)", async () => {
    await rejects(await fake.sign({}, { issuer: "https://evil.cloudflareaccess.com" }), /iss/);
  });

  it("rejects an expired token", async () => {
    await rejects(await fake.sign({}, { expiresIn: Math.floor(Date.now() / 1000) - 120 }), /expired/);
  });

  it("rejects a token signed by an unknown key", async () => {
    const { privateKey } = await generateKeyPair("RS256");
    await rejects(await fake.sign({}, { key: privateKey }), /signature/);
  });

  it("rejects unsigned (alg=none) tokens", async () => {
    const token = new UnsecuredJWT({ email: OWNER }).setIssuer(`https://${TEST_TEAM}`).setAudience(TEST_AUD).encode();
    await rejects(token, /.+/);
  });

  it("rejects HS256 tokens (algorithm confusion)", async () => {
    const token = await new SignJWT({ email: OWNER })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(`https://${TEST_TEAM}`)
      .setAudience(TEST_AUD)
      .setSubject("x")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode("a-shared-secret-of-sufficient-length!!"));
    await rejects(token, /.+/);
  });

  it("rejects service tokens (no email)", async () => {
    await rejects(await fake.sign({ email: undefined, common_name: "svc.access" }), /email/);
  });

  it("rejects non-app token types", async () => {
    await rejects(await fake.sign({ type: "org" }), /type/);
  });

  it("rejects garbage", async () => {
    await rejects("not-a-jwt", /malformed|JWS|JWT/i);
  });
});
