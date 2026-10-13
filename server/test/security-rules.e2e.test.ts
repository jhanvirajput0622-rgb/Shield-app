/**
 * Security rules: prove the Firestore data plane is unreachable from a client.
 *
 * `firestore.rules` has two zones, and this file covers the boundary of both:
 *
 *   1. Everything that is not `mobile*`-prefixed -- the live server-owned schema
 *      of 25 collections (server/src/db/schema.ts). Denied unconditionally. All
 *      access goes through the Express API using the Admin SDK, which bypasses
 *      rules. If these tests fail, the mobile app may have started talking to
 *      Firestore directly for server-owned data, which would bypass every
 *      authorisation check in `middleware/auth.middleware.ts` and every
 *      validator.
 *
 *   2. The `mobile*` collections -- the ERD modelled client-side in
 *      artifacts/mobile/lib/firestore/. This set IS reachable by clients, but
 *      only with a valid Firebase ID token, and only for documents the caller
 *      owns. The tests below assert that anonymous access is refused there too:
 *      the new grants must not have opened an unauthenticated hole.
 *
 * The rules are exercised over the emulator's REST endpoint using plain `fetch`
 * with no credentials -- i.e. exactly what a leaked config file or a curious
 * `curl` would produce. No `@firebase/rules-unit-testing` dependency is needed for
 * a ruleset whose answer to an anonymous caller is always "no".
 *
 * Paths below are document paths, so they must have an even number of segments
 * after `/documents/`. A three-segment path like the old `mobile/devices/x` is a
 * malformed document name: the REST layer rejects it with 400 INVALID_ARGUMENT
 * before rules are evaluated, so the assertion would pass without ever reaching
 * the ruleset. This is also why the ERD is namespaced with a collection-name
 * prefix rather than a path prefix -- see the header of schema.ts.
 *
 * The positive counterpart -- Admin SDK writes succeed despite the deny-all
 * rules -- is asserted in the same file, so the suite cannot pass by accident if
 * the emulator is serving without rules loaded at all. That distinction matters:
 * an emulator started without a rules file allows everything, so "denied" alone
 * is not proof the rules are active.
 *
 * NOTE: per-ownership enforcement inside the `mobile*` collections (that user A
 * cannot read user B's devices) is not covered here, because that needs an
 * authenticated rules-unit-testing context. It is asserted by the rules themselves
 * and should be pinned with `initializeTestEnvironment` if this file is ever
 * extended.
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

describe("the client-owned mobile* collections are still closed to anonymous callers", () => {
  // The `mobile*` set is intentionally client-reachable, unlike the server schema. It
  // is scoped per user by `request.auth.uid`, so an anonymous caller must still
  // be refused. These are the paths from COLLECTIONS in
  // artifacts/mobile/lib/firestore/schema.ts.

  const MOBILE_COLLECTIONS = [
    "mobileUsers",
    "mobileDevices",
    "mobileAntiThefts",
    "mobilePhishingDetections",
    "mobileVpnConnections",
    "mobileAppPermissions",
    "mobileProtectionSettings",
    "mobileSecurityLogs",
    "mobileAuditEvents",
    "mobileAppSessions",
    "mobileAdmins",
  ];

  it("rejects an anonymous read of every client-owned collection", async () => {
    const results = await Promise.all(
      MOBILE_COLLECTIONS.map((name) => unauthenticated("GET", name))
    );

    const allowed = results
      .map((response, index) => ({
        name: MOBILE_COLLECTIONS[index],
        status: response.status,
      }))
      .filter((entry) => entry.status !== 403);

    assert.deepEqual(
      allowed,
      [],
      `these mobile* collections were readable without credentials: ${JSON.stringify(allowed)}`
    );
  });

  it("rejects an anonymous write into the client-owned zone", async () => {
    // A two-segment path, so this is a document write and the rules are actually
    // evaluated. The old three-segment `mobile/devices/injected` was a malformed
    // document name that the REST layer rejected with 400 before any rule ran,
    // which made this assertion pass or fail for the wrong reason.
    const response = await unauthenticated(
      "PATCH",
      "mobileDevices/injected",
      { fields: { userId: { stringValue: "attacker" }, deviceName: { stringValue: "evil" } } }
    );
    assertDenied(response, "create a device anonymously");
  });

  it("never exposes the credential store, which holds password hashes", async () => {
    // Denied unconditionally, authenticated or not -- see the SERVER_ONLY block
    // in firestore.rules. If this ever opens, every user's hash is readable.
    for (const path of ["mobileCredentials/anyone", "mobileUserEmails/anyone"]) {
      assertDenied(await unauthenticated("GET", path), `GET ${path}`);
    }
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
