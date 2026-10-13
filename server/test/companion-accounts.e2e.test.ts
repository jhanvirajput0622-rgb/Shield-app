/**
 * E2E: companion accounts.
 *
 * This suite exists because of a specific, previously invisible defect: the
 * create path never set `isActive`, and the login path rejects with `forbidden`
 * when `isActive` is falsy. Because Firestore drops `undefined` fields, the
 * stored document had no `isActive` key at all -- so `POST
 * /api/companion-accounts` returned 201 and the account was created, and then
 * could never be used. Every test here passes a 2xx on its own; only logging in
 * exposes the bug.
 *
 * The last two tests are regression guards for the authorisation boundary, since
 * `isActive` is the switch that gates a login.
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { startTestServer, stopTestServer, get, post, data } from "./helpers/app";
import { truncateAll, readOneByField, idByField, patchRaw } from "./helpers/db";
import { createUser, uniqueEmail, VALID_PASSWORD } from "./helpers/fixtures";

const COMPANION_PASSWORD = "C0mpanion!Pass";

before(async () => {
  await startTestServer();
});

after(async () => {
  await stopTestServer();
});

beforeEach(async () => {
  await truncateAll();
});

describe("POST /api/companion-accounts", () => {
  it("creates an account that is immediately usable", async () => {
    const user = await createUser();
    const companionEmail = uniqueEmail();

    const created = await post(
      "/api/companion-accounts",
      { email: companionEmail, password: COMPANION_PASSWORD },
      { token: user.accessToken }
    );
    assert.equal(created.status, 201);

    // The whole point: creating is not enough, the account must be able to log in.
    const login = await post(
      "/api/companion-accounts/login",
      { email: companionEmail, password: COMPANION_PASSWORD },
      { token: user.accessToken }
    );
    assert.equal(
      login.status,
      200,
      "a freshly created companion account must be able to log in (isActive must be set)"
    );
    assert.ok(data(login).sessionId, "a session must be recorded");
  });

  it("persists isActive: true", async () => {
    const user = await createUser();
    const companionEmail = uniqueEmail();

    await post(
      "/api/companion-accounts",
      { email: companionEmail, password: COMPANION_PASSWORD },
      { token: user.accessToken }
    );

    const stored = await readOneByField("companionAccounts", "email", companionEmail);
    assert.equal(
      stored?.["isActive"],
      true,
      "isActive must be materialised, not left undefined (Firestore drops undefined)"
    );
  });

  it("stores a bcrypt hash, never the plaintext password", async () => {
    const user = await createUser();
    const companionEmail = uniqueEmail();

    await post(
      "/api/companion-accounts",
      { email: companionEmail, password: COMPANION_PASSWORD },
      { token: user.accessToken }
    );

    const stored = await readOneByField("companionAccounts", "email", companionEmail);
    const hash = String(stored?.["passwordHash"]);
    assert.match(hash, /^\$2[aby]\$12\$/, "expected a cost-12 bcrypt hash");
    assert.ok(!hash.includes(COMPANION_PASSWORD), "the plaintext password must not be stored");
  });

  it("enforces one companion account per user", async () => {
    const user = await createUser();
    const first = await post(
      "/api/companion-accounts",
      { email: uniqueEmail(), password: COMPANION_PASSWORD },
      { token: user.accessToken }
    );
    assert.equal(first.status, 201);

    const second = await post(
      "/api/companion-accounts",
      { email: uniqueEmail(), password: COMPANION_PASSWORD },
      { token: user.accessToken }
    );
    assert.equal(second.status, 409);
  });

  it("rejects an email already used by another user's companion account", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const shared = uniqueEmail();

    await post(
      "/api/companion-accounts",
      { email: shared, password: COMPANION_PASSWORD },
      { token: alice.accessToken }
    );
    const clash = await post(
      "/api/companion-accounts",
      { email: shared, password: COMPANION_PASSWORD },
      { token: bob.accessToken }
    );
    assert.equal(clash.status, 409);
  });

  it("requires authentication", async () => {
    const response = await post("/api/companion-accounts", {
      email: uniqueEmail(),
      password: COMPANION_PASSWORD
    });
    assert.equal(response.status, 401);
  });

  it("rejects a short password", async () => {
    const user = await createUser();
    const response = await post(
      "/api/companion-accounts",
      { email: uniqueEmail(), password: "short" },
      { token: user.accessToken }
    );
    assert.equal(response.status, 400);
  });
});

describe("POST /api/companion-accounts/login", () => {
  it("records a session with the login metadata", async () => {
    const user = await createUser();
    const companionEmail = uniqueEmail();
    await post(
      "/api/companion-accounts",
      { email: companionEmail, password: COMPANION_PASSWORD },
      { token: user.accessToken }
    );

    const login = await post(
      "/api/companion-accounts/login",
      { email: companionEmail, password: COMPANION_PASSWORD },
      { token: user.accessToken }
    );
    assert.equal(login.status, 200);

    const sessions = await get("/api/companion-accounts/sessions", { token: user.accessToken });
    assert.equal(sessions.status, 200);
    assert.equal(data(sessions).length, 1, "the login must be recorded as a session");
  });

  it("stamps lastLoginAt on the account", async () => {
    const user = await createUser();
    const companionEmail = uniqueEmail();
    await post(
      "/api/companion-accounts",
      { email: companionEmail, password: COMPANION_PASSWORD },
      { token: user.accessToken }
    );
    const before = await readOneByField("companionAccounts", "email", companionEmail);
    // Absent rather than null: `lastLoginAt` is not set at create time, and
    // Firestore drops undefined, so there is no key to read. Both the absent and
    // null forms are handled by the `?.toISOString() ?? null` in the controller.
    assert.ok(
      before?.["lastLoginAt"] === null || before?.["lastLoginAt"] === undefined,
      "no login recorded yet"
    );

    await post(
      "/api/companion-accounts/login",
      { email: companionEmail, password: COMPANION_PASSWORD },
      { token: user.accessToken }
    );

    const after = await readOneByField("companionAccounts", "email", companionEmail);
    assert.ok(after?.["lastLoginAt"], "lastLoginAt must be written on login");
  });

  it("rejects a wrong password", async () => {
    const user = await createUser();
    const companionEmail = uniqueEmail();
    await post(
      "/api/companion-accounts",
      { email: companionEmail, password: COMPANION_PASSWORD },
      { token: user.accessToken }
    );

    const response = await post(
      "/api/companion-accounts/login",
      { email: companionEmail, password: "Wr0ng!Password" },
      { token: user.accessToken }
    );
    assert.equal(response.status, 401);
  });

  it("rejects a wrong password even when the account is known", async () => {
    const user = await createUser();
    const companionEmail = uniqueEmail();
    await post(
      "/api/companion-accounts",
      { email: companionEmail, password: COMPANION_PASSWORD },
      { token: user.accessToken }
    );

    // Guards the bcrypt comparison actually running: a shortcut that returned 401
    // before comparing would also satisfy "rejects a wrong password".
    const wrong = await post(
      "/api/companion-accounts/login",
      { email: companionEmail, password: "Wr0ng!Password" },
      { token: user.accessToken }
    );
    const right = await post(
      "/api/companion-accounts/login",
      { email: companionEmail, password: COMPANION_PASSWORD },
      { token: user.accessToken }
    );
    assert.equal(wrong.status, 401);
    assert.equal(right.status, 200, "the same credentials must succeed on retry");
  });

  it("refuses a companion deactivated out of band", async () => {
    // `isActive` is the only gate on companion login, so flipping it must lock
    // the account out even with the correct password.
    const user = await createUser();
    const companionEmail = uniqueEmail();
    await post(
      "/api/companion-accounts",
      { email: companionEmail, password: COMPANION_PASSWORD },
      { token: user.accessToken }
    );

    const baseline = await post(
      "/api/companion-accounts/login",
      { email: companionEmail, password: COMPANION_PASSWORD },
      { token: user.accessToken }
    );
    assert.equal(baseline.status, 200, "baseline: an active account logs in");

    // Deactivate through the Admin SDK, the way a support action would.
    const id = await idByField("companionAccounts", "email", companionEmail);
    await patchRaw("companionAccounts", id, { isActive: false });

    const after = await post(
      "/api/companion-accounts/login",
      { email: companionEmail, password: COMPANION_PASSWORD },
      { token: user.accessToken }
    );
    assert.equal(after.status, 403, "a deactivated companion must be refused");
  });
});

describe("companion tenant isolation", () => {
  it("will not let one user log into another user's companion account", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const companionEmail = uniqueEmail();

    await post(
      "/api/companion-accounts",
      { email: companionEmail, password: COMPANION_PASSWORD },
      { token: alice.accessToken }
    );

    // The login filter is `{ userId: req.userId, email }`, so Bob's own token
    // must not match Alice's row even with the correct password.
    const response = await post(
      "/api/companion-accounts/login",
      { email: companionEmail, password: COMPANION_PASSWORD },
      { token: bob.accessToken }
    );
    assert.equal(response.status, 401);
  });

  it("404s the session list for a user with no companion account", async () => {
    // Not an empty array: `listSessions` resolves the caller's account first and
    // throws notFound when there is none, so there is no companionId to scope by.
    const user = await createUser();
    const response = await get("/api/companion-accounts/sessions", { token: user.accessToken });
    assert.equal(response.status, 404);
  });

  it("shows each user only their own companion sessions", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const aliceCompanion = uniqueEmail();
    const bobCompanion = uniqueEmail();

    for (const [user, companionEmail] of [
      [alice, aliceCompanion],
      [bob, bobCompanion],
    ] as const) {
      await post(
        "/api/companion-accounts",
        { email: companionEmail, password: COMPANION_PASSWORD },
        { token: user.accessToken }
      );
      await post(
        "/api/companion-accounts/login",
        { email: companionEmail, password: COMPANION_PASSWORD },
        { token: user.accessToken }
      );
    }

    const aliceSessions = await get("/api/companion-accounts/sessions", { token: alice.accessToken });
    const bobSessions = await get("/api/companion-accounts/sessions", { token: bob.accessToken });

    assert.equal(data(aliceSessions).length, 1);
    assert.equal(data(bobSessions).length, 1);
    assert.notEqual(
      data(aliceSessions)[0].id,
      data(bobSessions)[0].id,
      "each user must see only their own session"
    );
  });

  it("stores a companion session for the right owner", async () => {
    const user = await createUser();
    const companionEmail = uniqueEmail();
    await post(
      "/api/companion-accounts",
      { email: companionEmail, password: COMPANION_PASSWORD },
      { token: user.accessToken }
    );
    await post(
      "/api/companion-accounts/login",
      { email: companionEmail, password: COMPANION_PASSWORD },
      { token: user.accessToken }
    );

    const session = await readOneByField("companionSessions", "userId", user.id);
    assert.ok(session, "the session must reference the owning user");
  });
});
