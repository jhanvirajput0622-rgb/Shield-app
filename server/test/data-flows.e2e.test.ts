/**
 * E2E: device data flows, persistence and tenant isolation.
 *
 * The recurring theme is that a 2xx is not proof of a write. Every "persists"
 * case reads the document back with the Admin SDK, because a handler that echoes
 * its input while the write silently fails is the failure mode this suite is
 * built to catch.
 *
 * Tenant isolation gets its own section because it is the highest-consequence
 * class of bug in a multi-user security product: user B reading or mutating user
 * A's devices is a breach, and it will not show up in any single-user test.
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { startTestServer, stopTestServer, get, post, patch, del, data } from "./helpers/app";
import {
  truncateAll,
  truncateCollection,
  readRaw,
  readOneByField,
  seed,
  collectionSize,
} from "./helpers/db";
import { createUser, createDevice, uniqueEmail, VALID_PASSWORD } from "./helpers/fixtures";

before(async () => {
  await startTestServer();
});

after(async () => {
  await stopTestServer();
});

beforeEach(async () => {
  await truncateAll();
});

describe("POST /api/devices", () => {
  it("registers a device and persists it", async () => {
    const user = await createUser();
    const device = await createDevice(user, { deviceName: "Pixel 8", platform: "Android" });

    const raw = await readRaw("devices", device.id);
    assert.ok(raw, "the device document must exist");
    assert.equal(raw?.["userId"], user.id, "the device must be owned by the caller");
    assert.equal(raw?.["deviceName"], "Pixel 8");
    assert.equal(raw?.["platform"], "Android");
  });

  it("requires authentication", async () => {
    const response = await post("/api/devices", { deviceName: "Anonymous" });
    assert.equal(response.status, 401);
  });

  it("rejects a missing deviceName", async () => {
    const user = await createUser();
    const response = await post("/api/devices", {}, { token: user.accessToken });
    assert.equal(response.status, 400);
  });

  it("rejects an invalid platform", async () => {
    const user = await createUser();
    const response = await post(
      "/api/devices",
      { deviceName: "X", platform: "Windows" },
      { token: user.accessToken }
    );
    assert.equal(response.status, 400);
  });

  it("leaves the collection empty when validation fails", async () => {
    const user = await createUser();
    await post("/api/devices", {}, { token: user.accessToken });
    assert.equal(await collectionSize("devices"), 0, "a rejected request must not write");
  });
});

describe("GET /api/devices", () => {
  it("returns only the caller's devices", async () => {
    const alice = await createUser();
    const bob = await createUser();
    await createDevice(alice, { deviceName: "Alice Phone" });
    await createDevice(alice, { deviceName: "Alice Tablet" });
    await createDevice(bob, { deviceName: "Bob Phone" });

    const response = await get("/api/devices", { token: alice.accessToken });
    assert.equal(response.status, 200);

    const names = data(response).map((d: any) => d.deviceName).sort();
    assert.deepEqual(names, ["Alice Phone", "Alice Tablet"]);
  });

  it("returns an empty list rather than an error when the user has no devices", async () => {
    const user = await createUser();
    const response = await get("/api/devices", { token: user.accessToken });
    assert.equal(response.status, 200);
    assert.deepEqual(data(response), []);
  });

  it("orders by lastSeenAt descending", async () => {
    const user = await createUser();
    const older = await createDevice(user, { deviceName: "Older" });
    const newer = await createDevice(user, { deviceName: "Newer" });

    // Simulate the device reporting in, at two distinct times.
    const now = Date.now();
    await seed("devices", older.id, { lastSeenAt: new Date(now - 60_000) });
    await seed("devices", newer.id, { lastSeenAt: new Date(now) });

    const response = await get("/api/devices", { token: user.accessToken });
    assert.deepEqual(data(response).map((d: any) => d.deviceName), ["Newer", "Older"]);
  });

  it("serialises lastSeenAt as an ISO string, not a Firestore Timestamp", async () => {
    // deviceView calls `.toISOString()` on these; a raw Timestamp would 500.
    const user = await createUser();
    const device = await createDevice(user);
    await seed("devices", device.id, { lastSeenAt: new Date("2026-03-01T10:00:00.000Z") });

    const response = await get("/api/devices", { token: user.accessToken });
    assert.equal(response.status, 200);
    const [first] = data(response);
    assert.equal(first.lastSeenAt, "2026-03-01T10:00:00.000Z");
    assert.equal(typeof first.createdAt, "string");
  });
});

describe("GET /api/devices/:id", () => {
  it("returns the caller's own device", async () => {
    const user = await createUser();
    const device = await createDevice(user);
    const response = await get(`/api/devices/${device.id}`, { token: user.accessToken });

    assert.equal(response.status, 200);
    assert.equal(data(response).id, device.id);
  });

  it("returns 404 for another user's device, not 403", async () => {
    // 404 rather than 403: a 403 would confirm the id exists, leaking the
    // existence of another tenant's resource.
    const alice = await createUser();
    const bob = await createUser();
    const aliceDevice = await createDevice(alice);

    const response = await get(`/api/devices/${aliceDevice.id}`, { token: bob.accessToken });
    assert.equal(response.status, 404);
  });

  it("returns 404 for a non-existent id", async () => {
    const user = await createUser();
    const response = await get("/api/devices/does-not-exist", { token: user.accessToken });
    assert.equal(response.status, 404);
  });
});

describe("DELETE /api/devices/:id", () => {
  it("deletes the caller's device", async () => {
    const user = await createUser();
    const device = await createDevice(user);

    const response = await del(`/api/devices/${device.id}`, { token: user.accessToken });
    assert.ok(response.status === 200 || response.status === 204, `got ${response.status}`);
    assert.equal(await readRaw("devices", device.id), null, "the document must actually be gone");
  });

  it("does not delete another user's device", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const aliceDevice = await createDevice(alice);

    const response = await del(`/api/devices/${aliceDevice.id}`, { token: bob.accessToken });
    assert.equal(response.status, 404);
    assert.ok(await readRaw("devices", aliceDevice.id), "Alice's device must survive");
  });
});

describe("tenant isolation", () => {
  it("keeps device listings disjoint across three users", async () => {
    const users = await Promise.all([createUser(), createUser(), createUser()]);
    for (const [index, user] of users.entries()) {
      for (let n = 0; n <= index; n += 1) {
        await createDevice(user, { deviceName: `u${index}-d${n}` });
      }
    }

    for (const [index, user] of users.entries()) {
      const response = await get("/api/devices", { token: user.accessToken });
      const names = data(response).map((d: any) => d.deviceName).sort();
      assert.deepEqual(
        names,
        Array.from({ length: index + 1 }, (_, n) => `u${index}-d${n}`).sort(),
        `user ${index} must see only their own devices`
      );
    }
  });

  it("prevents a forged userId from widening a read", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const aliceDevice = await createDevice(alice);

    // A caller-supplied userId in the query string must never override the
    // identity taken from the verified JWT.
    const response = await get("/api/devices?userId=" + bob.id, { token: bob.accessToken });
    assert.deepEqual(data(response), [], "query-string userId must be ignored");
  });

  it("scopes a directly-seeded foreign document out of the listing", async () => {
    const alice = await createUser();
    await seed("devices", "planted", {
      userId: "someone-else",
      deviceName: "Planted",
      platform: "Android"
    });

    const response = await get("/api/devices", { token: alice.accessToken });
    assert.deepEqual(data(response), []);
  });
});

describe("GET /api/shield/settings", () => {
  it("returns the ShieldSettings shape from the OpenAPI spec", async () => {
    // Note: these two routes are the exception to the `{ success, data }`
    // envelope used elsewhere -- they return a bare `ShieldSettings`, which is
    // what `lib/api-spec/openapi.yaml` declares and what the generated client in
    // `lib/api-clients-react` deserialises into. Asserting `body.success` here
    // would be asserting a contract the spec does not make.
    const user = await createUser();
    const response = await get("/api/shield/settings/", { token: user.accessToken });

    assert.equal(response.status, 200);
    const body = response.body as Record<string, unknown>;
    for (const key of [
      "webProtectionEnabled",
      "vpnAutoConnect",
      "killSwitchEnabled",
      "notifyHighRiskApps",
      "notifyPhishingThreats",
      "notifyDeviceUnlock",
      "twoFactorEnabled",
      "lastLoginAt",
      "accountEmail",
      "linkedDeviceCount",
    ]) {
      assert.ok(key in body, `missing ${key} from the settings response`);
    }
    assert.equal(body.accountEmail, user.email);
  });

  it("seeds the settings row with defaults at registration", async () => {
    const user = await createUser();

    const stored = await readOneByField("settings", "userId", user.id);
    assert.ok(stored, "registration must write a settings row");

    // Every flag must be materialised at write time, not merely coerced on read.
    for (const [key, expected] of Object.entries({
      webProtectionEnabled: true,
      vpnAutoConnect: false,
      killSwitchEnabled: true,
      notifyHighRiskApps: true,
      notifyPhishingThreats: true,
      notifyDeviceUnlock: true,
    })) {
      assert.equal(stored?.[key], expected, `${key} should be seeded as ${expected}`);
    }
  });

  it("coerces a legacy settings row that predates the defaults", async () => {
    // A row written before SETTINGS_DEFAULTS existed stores none of the flags.
    // The read path must still satisfy the `required` list in the OpenAPI spec
    // rather than omitting the keys from the JSON.
    const user = await createUser();
    await truncateCollection("settings");
    await seed("settings", "legacy-row", { userId: user.id });

    const response = await get("/api/shield/settings/", { token: user.accessToken });
    assert.equal(response.status, 200);
    const body = response.body as Record<string, unknown>;
    assert.equal(body.webProtectionEnabled, false, "an unset flag must read as false, not vanish");
    assert.equal(body.vpnAutoConnect, false);
    assert.equal(body.linkedDeviceCount, 0);
  });

  it("is idempotent across repeated reads", async () => {
    const user = await createUser();
    await get("/api/shield/settings/", { token: user.accessToken });
    await get("/api/shield/settings/", { token: user.accessToken });

    assert.equal(
      await collectionSize("settings"),
      1,
      "a second read must reuse the existing row, not insert another"
    );
  });

  it("persists a settings patch", async () => {
    const user = await createUser();
    const response = await patch(
      "/api/shield/settings/",
      { vpnAutoConnect: true, killSwitchEnabled: true },
      { token: user.accessToken }
    );

    assert.equal(response.status, 200);

    const settings = await readOneByField("settings", "userId", user.id);
    assert.equal(settings?.["vpnAutoConnect"], true);
    assert.equal(settings?.["killSwitchEnabled"], true);
  });

  it("leaves omitted flags untouched rather than clearing them", async () => {
    const user = await createUser();
    await patch("/api/shield/settings/", { vpnAutoConnect: true }, { token: user.accessToken });
    await patch("/api/shield/settings/", { killSwitchEnabled: true }, { token: user.accessToken });

    const settings = await readOneByField("settings", "userId", user.id);
    assert.equal(settings?.["vpnAutoConnect"], true, "a partial patch must not reset other flags");
    assert.equal(settings?.["killSwitchEnabled"], true);
  });

  it("rejects an unknown setting key", async () => {
    const user = await createUser();
    const response = await patch(
      "/api/shield/settings/",
      { notASetting: true },
      { token: user.accessToken }
    );
    assert.equal(response.status, 400);
  });

  it("rejects an empty patch", async () => {
    const user = await createUser();
    const response = await patch("/api/shield/settings/", {}, { token: user.accessToken });
    assert.equal(response.status, 400);
  });

  it("does not expose one user's settings to another", async () => {
    const alice = await createUser();
    const bob = await createUser();
    await patch("/api/shield/settings/", { vpnAutoConnect: true }, { token: alice.accessToken });

    const bobSettings = await readOneByField("settings", "userId", bob.id);
    assert.notEqual(
      bobSettings?.["vpnAutoConnect"],
      true,
      "Bob must not inherit Alice's settings"
    );
  });
});

describe("GET /api/security/events", () => {
  it("paginates with a total that matches the seeded data", async () => {
    const user = await createUser();
    for (let i = 1; i <= 7; i += 1) {
      await seed("securityEvents", `e${i}`, {
        userId: user.id,
        eventType: "scan",
        severity: "low",
        title: `Event ${i}`,
        occurredAt: new Date(Date.UTC(2026, 0, 1, 0, i))
      });
    }

    const page1 = await get("/api/security/events?page=1&limit=3", { token: user.accessToken });
    assert.equal(page1.status, 200);
    assert.equal(data(page1).length, 3);
    assert.equal(page1.body.pagination.total, 7);
    assert.equal(page1.body.pagination.pages, 3);

    const page3 = await get("/api/security/events?page=3&limit=3", { token: user.accessToken });
    assert.equal(data(page3).length, 1, "the last page must be partial");
  });

  it("returns newest first", async () => {
    const user = await createUser();
    for (let i = 1; i <= 3; i += 1) {
      await seed("securityEvents", `n${i}`, {
        userId: user.id,
        eventType: "scan",
        severity: "low",
        title: `Event ${i}`,
        occurredAt: new Date(Date.UTC(2026, 0, 1, 0, i))
      });
    }

    const response = await get("/api/security/events", { token: user.accessToken });
    assert.deepEqual(
      data(response).map((e: any) => e.title),
      ["Event 3", "Event 2", "Event 1"]
    );
  });

  it("excludes another user's events", async () => {
    const alice = await createUser();
    const bob = await createUser();
    await seed("securityEvents", "alice-1", {
      userId: alice.id,
      eventType: "scan",
      severity: "high",
      title: "Alice event",
      occurredAt: new Date()
    });

    const response = await get("/api/security/events", { token: bob.accessToken });
    assert.deepEqual(data(response), []);
    assert.equal(response.body.pagination.total, 0);
  });

  it("clamps a hostile limit instead of trusting it", async () => {
    const user = await createUser();
    const response = await get("/api/security/events?limit=100000", { token: user.accessToken });
    assert.equal(response.body.pagination.limit, 100, "limit must be capped at 100");
  });

  it("requires authentication", async () => {
    const response = await get("/api/security/events");
    assert.equal(response.status, 401);
  });
});

describe("read-only collections", () => {
  it("GET /api/web-checks returns only the caller's checks", async () => {
    const alice = await createUser();
    const bob = await createUser();
    await seed("webChecks", "w-alice", {
      userId: alice.id,
      domain: "alice.example",
      verdict: "safe",
      checkedAt: new Date()
    });

    const aliceResponse = await get("/api/web-checks", { token: alice.accessToken });
    assert.equal(data(aliceResponse).length, 1);

    const bobResponse = await get("/api/web-checks", { token: bob.accessToken });
    assert.deepEqual(data(bobResponse), [], "checks must be scoped to the caller");
  });

  it("does not leak the encrypted URL ciphertext in a listing", async () => {
    const user = await createUser();
    await seed("webChecks", "w-secret", {
      userId: user.id,
      domain: "secret.example",
      verdict: "malicious",
      urlHash: "abc",
      encryptedUrl: "SENSITIVE-CIPHERTEXT-VALUE",
      checkedAt: new Date()
    });

    const response = await get("/api/web-checks", { token: user.accessToken });
    assert.ok(
      !JSON.stringify(response.body).includes("SENSITIVE-CIPHERTEXT-VALUE"),
      "encryptedUrl must not be returned to the client"
    );
  });

  it("GET /api/threats is a global advisory feed, not user-scoped", async () => {
    // `threats` is intentionally global: Threat.findById performs no ownership
    // check. Pinned here so that decision is explicit rather than accidental.
    const user = await createUser();
    await seed("threats", "t1", {
      isActive: true,
      severity: "High",
      threatType: "malware",
      title: "Global advisory",
      lastSeenAt: new Date()
    });

    const response = await get("/api/threats", { token: user.accessToken });
    assert.equal(response.status, 200);
    assert.ok(data(response).length >= 1, "the advisory feed must be visible to any user");
  });
});

describe("persistence across a fresh read", () => {
  it("a device written via the API is readable after a full round trip", async () => {
    const user = await createUser();
    const device = await createDevice(user, {
      deviceName: "Durable",
      deviceModel: "Pixel 8 Pro",
      osVersion: "15",
      appVersion: "2.1.0"
    });

    // Read back through a brand new HTTP request, not the create response.
    const response = await get(`/api/devices/${device.id}`, { token: user.accessToken });
    assert.equal(data(response).deviceModel, "Pixel 8 Pro");
    assert.equal(data(response).osVersion, "15");
    assert.equal(data(response).appVersion, "2.1.0");
  });

  it("a settings patch survives and is not reset by a later unrelated patch", async () => {
    const user = await createUser();
    await patch("/api/shield/settings/", { notifyPhishingThreats: true }, { token: user.accessToken });
    await patch("/api/shield/settings/", { webProtectionEnabled: true }, { token: user.accessToken });

    const settings = await readOneByField("settings", "userId", user.id);
    assert.equal(settings?.["notifyPhishingThreats"], true);
    assert.equal(settings?.["webProtectionEnabled"], true);
  });

  it("stamps createdAt and updatedAt on every persisted document", async () => {
    const user = await createUser();
    const device = await createDevice(user);
    const raw = await readRaw("devices", device.id);

    assert.ok(raw?.["createdAt"], "createdAt must be set");
    assert.ok(raw?.["updatedAt"], "updatedAt must be set");
    assert.ok(
      (raw?.["updatedAt"] as Date) >= (raw?.["createdAt"] as Date),
      "updatedAt must not precede createdAt"
    );
  });
});

describe("account lifecycle", () => {
  it("a user can register, use the API, and log out", async () => {
    const email = uniqueEmail();

    const registered = await post("/api/auth/register", {
      email,
      password: VALID_PASSWORD,
      displayName: "Lifecycle"
    });
    assert.equal(registered.status, 201);
    const token = data(registered).accessToken;

    const device = await post("/api/devices", { deviceName: "Lifecycle Device" }, { token });
    assert.equal(device.status, 201);

    const logout = await post("/api/auth/logout", {
      refreshToken: data(registered).refreshToken
    });
    assert.equal(logout.status, 200);

    const reuse = await post("/api/auth/refresh", { refreshToken: data(registered).refreshToken });
    assert.ok(reuse.status === 401 || reuse.status === 400);
  });
});
