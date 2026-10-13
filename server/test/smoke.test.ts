import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import { startTestServer, stopTestServer, get } from "./helpers/app";
import { truncateAll } from "./helpers/db";

describe("harness smoke test", () => {
  before(async () => {
    await startTestServer();
    await truncateAll();
  });

  after(async () => {
    await stopTestServer();
  });

  it("serves an unauthenticated liveness probe", async () => {
    const response = await get("/healthz");
    assert.equal(response.status, 200);
    assert.equal(response.body.status, "ok");
  });

  it("reports the Firestore emulator as connected", async () => {
    const response = await get("/api/health");
    // Note: this endpoint reports at the top level, not inside the { data } envelope.
    assert.equal(response.status, 200);
    assert.equal(response.body.databaseStatus, "connected");
    assert.equal(response.body.service, "Shield API");
  });
});
