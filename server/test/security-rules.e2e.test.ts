/**
 * Security rules: prove the Firestore data plane is unreachable from a client.
 *
 * `firestore.rules` denies every operation unconditionally. That is deliberate
 * and load-bearing, not a placeholder: all access goes through the Express API
 * using the Admin SDK, which bypasses rules. If these tests fail, the mobile app
 * may have started talking to Firestore directly, which would bypass every
 * authorisation check in `middleware/auth.middleware.ts` and every validator.
 *
 * The rules are exercised over the emulator's REST endpoint using plain `fetch`
 * with no credentials -- i.e. exactly what a leaked config file or a curious
 * `curl` would produce. No `@firebase/rules-unit-testing` dependency is needed for
 * a ruleset whose answer is always "no".
 *
 * The positive counterpart -- Admin SDK writes succeed despite the deny-all
 * rules -- is asserted in the same file, so the suite cannot pass by accident if
 * the emulator is serving without rules loaded at all. That distinction matters:
 * an emulator started without a rules file allows everything, so "denied" alone
 * is not proof the rules are active.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import "./helpers/env";

import { startTestServer, stopTestServer, post } from "./helpers/app";
import { createUser } from "./helpers/fixtures";
import { seed, readRaw, truncateAll } from "./helpers/db";
import { COLLECTIONS } from "../src/db/schema";

const PROJECT_ID = "demo-shield";
const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST;

/** The emulator exposes the Firestore v1 REST surface for rule evaluation. */
function restUrl(path: string): string {
  assert.ok(EMULATOR, "FIRESTORE_EMULATOR_HOST must be set; run via test/run.sh");
  return `http://${EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
}

async function unauthenticated(method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(restUrl(path), {
    method,
    headers: {
      // No Authorization header: the rules must reject on identity alone.
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Firestore reports a rules rejection as HTTP 403 with PERMISSION_DENIED. */
function assertDenied(response: Response, label: string): void {
  assert.equal(
    response.status,
    403,
    `${label} must be rejected by firestore.rules, got ${response.status}`
  );
}

before(async () => {
  await startTestServer();
  await truncateAll();
});

after(async () => {
  await stopTestServer();
});

describe("firestore.rules denies client access", () => {
  it("rejects an unauthenticated read of a single document", async () => {
    await seed("users", "victim", { email: "victim@test.dev" });

    const response = await unauthenticated("GET", "users/victim");
    assertDenied(response, "GET users/{id}");
  });

  it("rejects an unauthenticated list query", async () => {
    const response = await unauthenticated("GET", "users");
    assertDenied(response, "list users");
  });

  it("rejects an unauthenticated create", async () => {
    const response = await unauthenticated(
      "PATCH",
      "users/injected",
      { fields: { email: { stringValue: "attacker@test.dev" } } }
    );
    assertDenied(response, "create a user");
  });

  it("rejects an unauthenticated overwrite", async () => {
    const response = await unauthenticated(
      "PATCH",
      "users/victim",
      { fields: { email: { stringValue: "attacker@test.dev" } } }
    );
    assertDenied(response, "overwrite a user");
  });

  it("rejects an unauthenticated delete", async () => {
    const response = await unauthenticated("DELETE", "users/victim");
    assertDenied(response, "delete a user");
  });

  it("rejects a malformed bearer token", async () => {
    // The emulator validates the credential shape *before* evaluating rules, so a
    // garbage token is refused with 400 and rule evaluation never runs. Either
    // way the read is refused, which is the property that matters.
    const response = await fetch(restUrl("users/victim"), {
      headers: { Authorization: "Bearer not-a-jwt" },
    });
    assert.ok(
      response.status === 400 || response.status === 403,
      `expected the request to be refused, got ${response.status}`
    );
  });

  it("rejects a well-formed but unverifiable bearer token", async () => {
    // This is the token-theft scenario that actually reaches the rules: a
    // syntactically valid JWT (three base64url segments) that the emulator cannot
    // verify. It gets all the way to rule evaluation and is then denied, which
    // proves the ruleset -- not just credential parsing -- is doing the work.
    const segment = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const forged = `${segment({ alg: "HS256", typ: "JWT" })}.${segment({
      sub: "victim",
      role: "admin",
    })}.${Buffer.from("not-a-real-signature").toString("base64url")}`;

    const response = await fetch(restUrl("users/victim"), {
      headers: { Authorization: `Bearer ${forged}` },
    });
    assertDenied(response, "GET users/{id} with a forged but well-formed token");
  });

  it("rejects access to every collection", async () => {
    const uniqueCollections = [...new Set(Object.values(COLLECTIONS))];
    const results = await Promise.all(
      uniqueCollections.map((name) => unauthenticated("GET", name))
    );

    const allowed = results
      .map((response, index) => ({ name: uniqueCollections[index], status: response.status }))
      .filter((entry) => entry.status !== 403);

    assert.deepEqual(
      allowed,
      [],
      `these collections were readable without credentials: ${JSON.stringify(allowed)}`
    );
  });
});

describe("Admin SDK bypass remains the only path in", () => {
  it("writes a document that the REST surface refuses to create", async () => {
    // Proves the emulator actually has the deny-all rules loaded. Without this,
    // every 403 above would be indistinguishable from an emulator that silently
    // ignored the ruleset.
    await seed("devices", "server-written", { userId: "u1", deviceName: "Admin" });

    const stored = await readRaw("devices", "server-written");
    assert.ok(stored, "the Admin SDK write must have landed");
    assert.equal(stored?.["deviceName"], "Admin");

    const viaRest = await unauthenticated("GET", "devices/server-written");
    assertDenied(viaRest, "reading back the same document over REST");
  });

  it("the API can still read what it wrote", async () => {
    const user = await createUser();
    const device = await post(
      "/api/devices",
      { deviceName: "Rules Check" },
      { token: user.accessToken }
    );

    assert.equal(device.status, 201);
    const stored = await readRaw("devices", (device.body as any).data.id as string);
    assert.equal(stored?.["deviceName"], "Rules Check");
  });
});
