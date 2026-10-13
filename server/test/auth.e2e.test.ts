/**
 * E2E: the authentication lifecycle.
 *
 * These assertions go through HTTP against the real Express app, the real JWT
 * middleware and the real Firestore emulator. Where a test claims something was
 * *persisted*, it reads the document back with the Admin SDK rather than
 * trusting the response body -- an endpoint that echoes its input while silently
 * failing to write is exactly the bug this suite exists to catch.
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { startTestServer, stopTestServer, get, post, data } from "./helpers/app";
import { truncateAll, readRaw, collectionSize } from "./helpers/db";
import { createUser, uniqueEmail, VALID_PASSWORD } from "./helpers/fixtures";

before(async () => {
  await startTestServer();
});

after(async () => {
  await stopTestServer();
});

beforeEach(async () => {
  await truncateAll();
});

describe("POST /api/auth/register", () => {
  it("creates a user and returns both tokens", async () => {
    const email = uniqueEmail();
    const response = await post("/api/auth/register", {
      email,
      password: VALID_PASSWORD,
      displayName: "Ada Lovelace",
      name: "Ada Lovelace"
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.success, true);

    const payload = data(response);
    assert.ok(payload.accessToken, "accessToken must be returned");
    assert.ok(payload.refreshToken, "refreshToken must be returned");
    assert.equal(payload.user.email, email);
  });

  it("actually persists the user document", async () => {
    const user = await createUser({ displayName: "Grace Hopper" });
    const raw = await readRaw("users", user.id);

    assert.ok(raw, "the user document must exist in Firestore");
    assert.equal(raw?.["email"], user.email);
    assert.equal(raw?.["displayName"], "Grace Hopper");
    assert.ok(raw?.["passwordHash"], "passwordHash must be stored");
    assert.ok(raw?.["createdAt"], "createdAt must be stamped by the data layer");
  });

  it("stores a bcrypt hash, never the plaintext password", async () => {
    const user = await createUser();
    const raw = await readRaw("users", user.id);
    const hash = String(raw?.["passwordHash"]);

    assert.notEqual(hash, VALID_PASSWORD);
    assert.match(hash, /^\$2[aby]\$12\$/, "expected a bcrypt cost-12 hash");
    assert.ok(!hash.includes(VALID_PASSWORD), "plaintext must not appear in the hash");
  });

  it("rejects a duplicate email", async () => {
    const email = uniqueEmail();
    await createUser({ email });

    const response = await post("/api/auth/register", {
      email,
      password: VALID_PASSWORD,
      displayName: "Duplicate"
    });
    assert.ok(
      response.status === 409 || response.status === 400,
      `expected a rejection, got ${response.status}`
    );
  });

  it("never returns the password hash in the response body", async () => {
    const response = await post("/api/auth/register", {
      email: uniqueEmail(),
      password: VALID_PASSWORD,
      displayName: "Leaky"
    });
    const serialized = JSON.stringify(response.body);
    assert.ok(!serialized.includes("passwordHash"), "passwordHash must not be serialised");
    assert.ok(!serialized.includes(VALID_PASSWORD), "plaintext must not be serialised");
  });

  it("rejects a weak password with a validation error", async () => {
    const response = await post("/api/auth/register", {
      email: uniqueEmail(),
      password: "weak",
      displayName: "Weak"
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "VALIDATION_ERROR");
  });

  it("rejects a malformed email", async () => {
    const response = await post("/api/auth/register", {
      email: "not-an-email",
      password: VALID_PASSWORD,
      displayName: "Bad Email"
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "VALIDATION_ERROR");
  });

  it("falls back to the email local-part when no display name is given", async () => {
    // displayName is optional in the validator and the service derives a value
    // from the address rather than storing undefined, so the projection in
    // GET /api/auth/me can never emit a null name.
    const email = "nameless.user@test.dev";
    const response = await post("/api/auth/register", {
      email,
      password: VALID_PASSWORD
    });
    assert.equal(response.status, 201);

    const raw = await readRaw("users", data(response).user.id);
    assert.equal(raw?.["displayName"], "nameless.user");
    assert.ok(raw?.["displayName"], "displayName must never be persisted as undefined");
  });

  it("lowercases the stored email so lookups are case-insensitive", async () => {
    const email = uniqueEmail().toUpperCase();
    const user = await createUser({ email });
    const raw = await readRaw("users", user.id);
    assert.equal(raw?.["email"], email.toLowerCase());
  });
});

describe("POST /api/auth/login", () => {
  it("returns a fresh access token for valid credentials", async () => {
    const user = await createUser();
    const response = await post("/api/auth/login", {
      email: user.email,
      password: VALID_PASSWORD
    });

    assert.equal(response.status, 200);
    assert.ok(data(response).accessToken);
  });

  it("accepts a differently-cased email", async () => {
    const user = await createUser();
    const response = await post("/api/auth/login", {
      email: user.email.toUpperCase(),
      password: VALID_PASSWORD
    });
    assert.equal(response.status, 200);
  });

  it("rejects a wrong password with 401", async () => {
    const user = await createUser();
    const response = await post("/api/auth/login", {
      email: user.email,
      password: "Wr0ng!Password"
    });
    assert.equal(response.status, 401);
  });

  it("rejects an unknown email with 401", async () => {
    const response = await post("/api/auth/login", {
      email: uniqueEmail("ghost"),
      password: VALID_PASSWORD
    });
    assert.equal(response.status, 401);
  });

  it("records lastLoginAt on the user document", async () => {
    const user = await createUser();
    await post("/api/auth/login", { email: user.email, password: VALID_PASSWORD });

    const raw = await readRaw("users", user.id);
    assert.ok(raw?.["lastLoginAt"], "lastLoginAt must be written on login");
  });
});

describe("POST /api/auth/refresh", () => {
  it("exchanges a refresh token for a new access token", async () => {
    const user = await createUser();
    const response = await post("/api/auth/refresh", { refreshToken: user.refreshToken });

    assert.equal(response.status, 200);
    assert.ok(data(response).accessToken);
  });

  it("persists a hashed refresh token, never the raw value", async () => {
    const user = await createUser();
    const raw = await readRaw("refreshTokens", user.refreshToken);
    // The document ID is not the raw token; the sha256 digest lives in tokenHash.
    assert.equal(raw, null, "a document must not be keyed by the raw token");

    const tokens = await collectionSize("refreshTokens");
    assert.ok(tokens >= 1, "a refresh token document must be persisted");
  });

  it("rejects a bogus refresh token", async () => {
    const response = await post("/api/auth/refresh", { refreshToken: "0".repeat(64) });
    assert.ok(response.status === 401 || response.status === 400, `got ${response.status}`);
  });

  it("returns a usable access token from the refreshed pair", async () => {
    const user = await createUser();
    const refreshed = await post("/api/auth/refresh", { refreshToken: user.refreshToken });
    const token = data(refreshed).accessToken;

    const me = await get("/api/auth/me", { token });
    assert.equal(me.status, 200);
    assert.equal(me.body.data.email, user.email);
  });
});

describe("GET /api/auth/me", () => {
  it("returns the authenticated profile", async () => {
    const user = await createUser();
    const response = await get("/api/auth/me", { token: user.accessToken });

    assert.equal(response.status, 200);
    assert.equal(data(response).email, user.email);
  });

  it("rejects a request with no Authorization header", async () => {
    const response = await get("/api/auth/me");
    assert.equal(response.status, 401);
  });

  it("rejects a malformed Authorization header", async () => {
    const response = await get("/api/auth/me", { headers: { Authorization: "Token abc" } });
    assert.equal(response.status, 401);
  });

  it("rejects a token signed with the wrong secret", async () => {
    // Guards against `verify: false` or a secret fallback sneaking in.
    const jwt = (await import("jsonwebtoken")).default;
    const forged = jwt.sign({ sub: "someone", email: "attacker@evil.test" }, "a".repeat(64), {
      expiresIn: "1h"
    });
    const response = await get("/api/auth/me", { token: forged });
    assert.equal(response.status, 401);
  });

  it("rejects an expired token", async () => {
    const jwt = (await import("jsonwebtoken")).default;
    const expired = jwt.sign({ sub: "someone", email: "x@y.test" }, process.env.JWT_SECRET!, {
      expiresIn: "-1s"
    });
    const response = await get("/api/auth/me", { token: expired });
    assert.equal(response.status, 401);
  });

  it("rejects an alg=none token", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({ sub: "attacker", email: "attacker@evil.test", exp: 9999999999 })
    ).toString("base64url");
    const response = await get("/api/auth/me", { token: `${header}.${payload}.` });
    assert.equal(response.status, 401);
  });
});

describe("POST /api/auth/logout", () => {
  it("revokes the supplied refresh token", async () => {
    const user = await createUser();
    const logout = await post("/api/auth/logout", { refreshToken: user.refreshToken });
    assert.equal(logout.status, 200);

    const reuse = await post("/api/auth/refresh", { refreshToken: user.refreshToken });
    assert.ok(reuse.status === 401 || reuse.status === 400, "a revoked token must not refresh");
  });

  it("is idempotent for an already-revoked token", async () => {
    const user = await createUser();
    await post("/api/auth/logout", { refreshToken: user.refreshToken });
    const second = await post("/api/auth/logout", { refreshToken: user.refreshToken });
    assert.equal(second.status, 200);
  });
});

describe("POST /api/auth/logout-all", () => {
  it("revokes every refresh token for the user", async () => {
    const user = await createUser();
    const second = await post("/api/auth/login", { email: user.email, password: VALID_PASSWORD });
    const otherRefresh = data(second).refreshToken;
    assert.notEqual(otherRefresh, user.refreshToken);

    const response = await post("/api/auth/logout-all", {}, { token: user.accessToken });
    assert.equal(response.status, 200);

    for (const token of [user.refreshToken, otherRefresh]) {
      const reuse = await post("/api/auth/refresh", { refreshToken: token });
      assert.ok(reuse.status === 401 || reuse.status === 400, "all sessions must be revoked");
    }
  });

  it("requires authentication", async () => {
    const response = await post("/api/auth/logout-all", {});
    assert.equal(response.status, 401);
  });
});

describe("2FA", () => {
  it("runs setup, verify and disable end to end", async () => {
    const user = await createUser();

    // ── setup: persists a pending secret but does not enable 2FA ────────────
    const setup = await post("/api/auth/2fa/setup", {}, { token: user.accessToken });
    assert.equal(setup.status, 200);
    const { secret } = data(setup);
    assert.ok(secret, "setup must return an otpauth secret");
    assert.match(String(data(setup).qrCode), /^data:image\/png;base64,/, "expected a QR data URI");

    const pending = await readRaw("users", user.id);
    assert.equal(typeof pending?.["twoFactorSecret"], "string");
    assert.notEqual(pending?.["twoFactorSecret"], secret, "the pending seed must be encrypted at rest");
    assert.notEqual(pending?.["twoFactorEnabled"], true, "setup alone must not enable 2FA");

    // ── verify: a real TOTP code enables 2FA and clears the pending secret ──
    const { authenticator } = await import("otplib");
    const verify = await post(
      "/api/auth/2fa/verify",
      { otp: authenticator.generate(secret) },
      { token: user.accessToken }
    );
    assert.equal(verify.status, 200);

    const enabled = await readRaw("users", user.id);
    assert.equal(enabled?.["twoFactorEnabled"], true);
    // The seed is retained after verification because login re-verifies each OTP
    // against it; only /2fa/disable clears it. See UserDoc.twoFactorSecret.
    assert.equal(enabled?.["twoFactorSecret"], secret, "the seed must survive verification");

    // ── disable: requires the password and clears the flag ───────────────────
    const disable = await post(
      "/api/auth/2fa/disable",
      { password: VALID_PASSWORD },
      { token: user.accessToken }
    );
    assert.equal(disable.status, 200);

    const after = await readRaw("users", user.id);
    assert.notEqual(after?.["twoFactorEnabled"], true, "twoFactorEnabled must be cleared");
    assert.equal(after?.["twoFactorSecret"], undefined, "the seed must be cleared on disable");
  });

  it("rejects a wrong TOTP code", async () => {
    const user = await createUser();
    const setup = await post("/api/auth/2fa/setup", {}, { token: user.accessToken });
    const { secret } = data(setup);

    // 401 rather than 400: the OTP is a credential, so "unauthorized" is the
    // honest status and avoids telling an attacker which half of the pair failed.
    const verify = await post("/api/auth/2fa/verify", { otp: "000000" }, { token: user.accessToken });
    assert.equal(verify.status, 401);

    const still = await readRaw("users", user.id);
    assert.equal(still?.["twoFactorEnabled"], undefined, "a failed verify must not enable 2FA");
    assert.equal(still?.["twoFactorSecret"], secret, "the pending secret must survive a failed verify");
  });

  it("requires an OTP at login once 2FA is enabled", async () => {
    const user = await createUser();
    const setup = await post("/api/auth/2fa/setup", {}, { token: user.accessToken });
    const { authenticator } = await import("otplib");
    await post(
      "/api/auth/2fa/verify",
      { otp: authenticator.generate(data(setup).secret) },
      { token: user.accessToken }
    );

    const withoutOtp = await post("/api/auth/login", {
      email: user.email,
      password: VALID_PASSWORD
    });
    assert.equal(withoutOtp.status, 401, "a password alone must not be enough once 2FA is on");

    const withBadOtp = await post("/api/auth/login", {
      email: user.email,
      password: VALID_PASSWORD,
      otp: "000000"
    });
    assert.equal(withBadOtp.status, 401);

    const withGoodOtp = await post("/api/auth/login", {
      email: user.email,
      password: VALID_PASSWORD,
      otp: authenticator.generate(data(setup).secret)
    });
    assert.equal(withGoodOtp.status, 200, "password plus a valid OTP must succeed");
  });

  it("rejects disabling 2FA with a wrong password", async () => {
    const user = await createUser();
    const setup = await post("/api/auth/2fa/setup", {}, { token: user.accessToken });
    const { authenticator } = await import("otplib");
    await post(
      "/api/auth/2fa/verify",
      { otp: authenticator.generate(data(setup).secret) },
      { token: user.accessToken }
    );

    const disable = await post(
      "/api/auth/2fa/disable",
      { password: "Wr0ng!Password" },
      { token: user.accessToken }
    );
    assert.ok(disable.status === 400 || disable.status === 401, `got ${disable.status}`);

    const after = await readRaw("users", user.id);
    assert.equal(after?.["twoFactorEnabled"], true, "2FA must stay enabled after a failed disable");
  });

  it("requires authentication for setup", async () => {
    const response = await post("/api/auth/2fa/setup", {});
    assert.equal(response.status, 401);
  });
});

describe("POST /api/auth/forgot-password and reset-password", () => {
  it("does not reveal whether an address is registered", async () => {
    // An enumeration oracle here would let an attacker confirm which emails have
    // accounts, so both branches must look identical to the caller.
    const known = await createUser();
    const knownResponse = await post("/api/auth/forgot-password", { email: known.email });
    const unknownResponse = await post("/api/auth/forgot-password", { email: uniqueEmail("ghost") });

    assert.equal(knownResponse.status, unknownResponse.status);
    assert.deepEqual(knownResponse.body, unknownResponse.body);
  });

  it("rejects a reset with an invalid token", async () => {
    const response = await post("/api/auth/reset-password", {
      token: "0".repeat(64),
      password: "N3w!Password"
    });
    assert.ok(response.status === 400 || response.status === 401, `got ${response.status}`);
  });

  it("rejects a reset whose confirmation does not match", async () => {
    const user = await createUser();
    await post("/api/auth/forgot-password", { email: user.email });

    const response = await post("/api/auth/reset-password", {
      token: "whatever",
      password: "N3w!Password",
      confirmPassword: "Different!1"
    });
    assert.equal(response.status, 400);
  });
});

describe("POST /api/auth/firebase-token", () => {
  // The custom-token exchange is what lets the mobile client reach the
  // client-owned Firestore schema, whose rules are keyed on `request.auth.uid`.
  // The suite runs against the Firestore emulator, which serves Firestore but not
  // Auth, so the *happy path* cannot be exercised here — there is no service
  // account to sign with. What can be pinned is everything around it: the auth
  // requirement, and that an unreachable Auth backend is reported as 501 rather
  // than 500, because the client branches on that status to fall back to the API.
  // A 500 here would read as "retry", which would never succeed.

  it("requires a valid access token", async () => {
    const anonymous = await post("/api/auth/firebase-token");
    assert.equal(anonymous.status, 401);

    const garbage = await post("/api/auth/firebase-token", undefined, { token: "not-a-jwt" });
    assert.equal(garbage.status, 401);
  });

  it("reports 501 when Firebase Auth is unavailable, not 500", async () => {
    const user = await createUser();
    const response = await post("/api/auth/firebase-token", undefined, {
      token: user.accessToken,
    });

    // The emulator sets FIRESTORE_EMULATOR_HOST, which the service treats as
    // "Auth is off" before it ever tries to reach Google.
    assert.equal(
      response.status,
      501,
      `expected 501 under the emulator, got ${response.status}: ${JSON.stringify(response.body)}`
    );
    assert.equal(response.body.success, false);
    assert.match(response.body.error.message, /Firebase Auth/i);
  });
});

describe("error envelope", () => {
  it("returns a consistent shape for an unknown route", async () => {
    const response = await get("/api/definitely-not-a-route");
    assert.equal(response.status, 404);
    assert.equal(response.body.success, false);
    assert.ok(response.body.error.message);
  });

  it("returns a consistent shape for a validation failure", async () => {
    const response = await post("/api/auth/login", {});
    assert.equal(response.body.success, false);
    assert.equal(response.body.error.code, "VALIDATION_ERROR");
    assert.ok(Array.isArray(response.body.error.details));
  });
});
