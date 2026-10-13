/**
 * Data-layer contract tests for `src/db/queries.ts`.
 *
 * These run against the Firestore emulator and are the regression net for the
 * NoSQL access patterns the whole API is built on. They are deliberately
 * written against the *query* layer rather than HTTP, because a failure here
 * (a wrong filter operator, a cursor that skips a record) surfaces through
 * twenty-three route files and is very hard to localise from the outside.
 *
 * Two of these cases exist because they were live defects:
 *   - "resolves every registered collection key" -- `webChecks` was missing
 *     from COLLECTIONS, so `getCollection("webChecks")` called
 *     `collection(undefined)`.
 *   - "docExists reports presence" -- `DocumentReference#exists()` does not
 *     exist in the Admin SDK, so the old implementation threw a TypeError.
 */

import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  COLLECTIONS,
  SCHEMA_MARKER_ID
} from "../src/db/schema";
import type { CollectionKey, DocOf } from "../src/db/schema";
import {
  getCollection,
  normalizeFilters,
  stripUndefined,
  listDocs,
  listDocsBy,
  findOneBy,
  countDocs,
  countDocsByScan,
  getDocById,
  docExists,
  createDoc,
  updateDoc,
  upsertDoc,
  runBatch,
  deleteDoc,
  deleteWhere,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE
} from "../src/db/queries";
import type { ListResult } from "../src/db/queries";
import { initFirestore } from "../src/config/firestore";
import { seed, truncateAll, seedSchemaMarkers, readRaw } from "./helpers/db";

const USER_A = "user-a";
const USER_B = "user-b";

/**
 * Untyped document reference for use inside `runBatch`.
 *
 * `getCollection("devices")` is deliberately typed, and a Firestore `WriteBatch`
 * demands a *complete* `WithFieldValue<DeviceDoc>` -- which is the right
 * constraint for production code that constructs whole documents, but wrong for
 * a test deliberately writing a partial shape. The schema's required fields are
 * asserted in the `createDoc` suite instead.
 */
function ref(collection: CollectionKey, id: string): FirebaseFirestore.DocumentReference {
  return (getCollection(collection) as unknown as FirebaseFirestore.CollectionReference)
    .doc(id) as unknown as FirebaseFirestore.DocumentReference;
}

/** Deterministic base time so ordering assertions are stable. */
const T0 = new Date("2026-01-01T00:00:00.000Z").getTime();
const at = (minutes: number): Date => new Date(T0 + minutes * 60_000);

before(async () => {
  initFirestore();
});

beforeEach(async () => {
  await truncateAll();
});

describe("collection registry", () => {
  it("resolves every registered collection key", () => {
    // `getCollection` dereferences COLLECTIONS[key]; an absent key silently
    // produces `collection(undefined)`, which throws deep inside the SDK.
    for (const key of Object.keys(COLLECTIONS) as CollectionKey[]) {
      assert.doesNotThrow(() => getCollection(key), `getCollection("${key}") threw`);
    }
  });

  it("includes webChecks, which shares the web_checks collection", () => {
    assert.equal(COLLECTIONS.webChecks, "web_checks");
    assert.equal(COLLECTIONS.phishingChecks, "web_checks");
  });

  it("aliases webChecks onto web_checks and nothing else", () => {
    // 26 keys, 25 physical collections. Any second duplicate would mean a
    // typo silently merged two logical collections into one physical store.
    const byCount = new Map<string, string[]>();
    for (const [key, path] of Object.entries(COLLECTIONS)) {
      byCount.set(path, [...(byCount.get(path) ?? []), key]);
    }
    const aliased = [...byCount.entries()].filter(([, keys]) => keys.length > 1);
    assert.equal(aliased.length, 1, `expected exactly one alias, found ${JSON.stringify(aliased)}`);
    assert.deepEqual(aliased[0][1].sort(), ["phishingChecks", "webChecks"]);
    assert.equal(aliased[0][0], "web_checks");
  });
});

describe("normalizeFilters", () => {
  it("maps a bare value to equality", () => {
    assert.deepEqual(normalizeFilters({ status: "lost" }), [
      { field: "status", op: "==", value: "lost" }
    ]);
  });

  it("maps every supported operator", () => {
    const filters = normalizeFilters({
      a: { $eq: 1 },
      b: { $ne: 2 },
      c: { $in: [3] },
      d: { $nin: [4] },
      e: { $contains: "x" },
      f: { $containsAny: ["y"] },
      g: { $gt: 5 },
      h: { $gte: 6 },
      i: { $lt: 7 },
      j: { $lte: 8 }
    });
    assert.deepEqual(
      filters.map((f) => f.op),
      ["==", "!=", "in", "not-in", "array-contains", "array-contains-any", ">", ">=", "<", "<="]
    );
  });

  it("expands a bare array to an `in` filter (legacy shorthand)", () => {
    assert.deepEqual(normalizeFilters({ _id: ["a", "b"] }), [
      { field: "_id", op: "in", value: ["a", "b"] }
    ]);
  });

  it("returns an empty list for undefined", () => {
    assert.deepEqual(normalizeFilters(undefined), []);
  });

  it("rejects an unknown operator rather than silently ignoring it", () => {
    // A typo'd operator that fell through would widen the result set and return
    // every document in the collection -- a silent data-leak-shaped failure.
    assert.throws(
      () => normalizeFilters({ status: { $regex: "x" } }),
      /Unsupported Firestore filter operator/
    );
  });
});

describe("stripUndefined", () => {
  it("drops undefined but keeps null", () => {
    const result = stripUndefined({ a: 1, b: undefined, c: null });
    assert.deepEqual(result, { a: 1, c: null });
    assert.ok("c" in result, "null must survive -- it is a meaningful value");
  });
});

describe("createDoc", () => {
  it("stamps _id, createdAt and updatedAt", async () => {
    await createDoc("devices", "dev-1", {
      userId: USER_A,
      deviceName: "Pixel",
      platform: "Android"
    } as never);

    const raw = await readRaw("devices", "dev-1");
    assert.equal(raw?.["_id"], "dev-1");
    assert.ok(raw?.["createdAt"], "createdAt must be stamped");
    assert.ok(raw?.["updatedAt"], "updatedAt must be stamped");
  });

  it("omits undefined fields instead of writing them", async () => {
    await createDoc("devices", "dev-2", {
      userId: USER_A,
      deviceName: "Pixel",
      platform: "Android",
      locationLabel: undefined
    } as never);

    const raw = await readRaw("devices", "dev-2");
    assert.equal("locationLabel" in (raw as object), false);
  });
});

describe("getDocById / docExists", () => {
  beforeEach(async () => {
    await createDoc("devices", "dev-1", { userId: USER_A, deviceName: "A" } as never);
  });

  it("returns the document with _id populated", async () => {
    const doc = await getDocById("devices", "dev-1");
    assert.equal(doc?._id, "dev-1");
    assert.equal(doc?.userId, USER_A);
  });

  it("returns null for a missing document rather than throwing", async () => {
    assert.equal(await getDocById("devices", "nope"), null);
  });

  it("hydrates Firestore Timestamps into Date instances", async () => {
    // Controllers call `.toISOString()` on these, so a raw Timestamp would throw.
    const doc = await getDocById("devices", "dev-1");
    assert.ok(doc?.createdAt instanceof Date, "createdAt must be a Date");
  });

  it("docExists reports presence", async () => {
    assert.equal(await docExists("devices", "dev-1"), true);
  });

  it("docExists reports absence without throwing", async () => {
    // Regression: the previous implementation called DocumentReference#exists(),
    // which does not exist in the Admin SDK and threw a TypeError.
    assert.equal(await docExists("devices", "missing"), false);
  });

  it("treats the bootstrap sentinel as non-existent", async () => {
    await seedSchemaMarkers();
    assert.equal(await docExists("devices", SCHEMA_MARKER_ID), false);
    assert.equal(await getDocById("devices", SCHEMA_MARKER_ID), null);
  });
});

describe("listDocs filtering", () => {
  beforeEach(async () => {
    // 6 devices, 4 belonging to USER_A.
    const rows = [
      { id: "d1", userId: USER_A, status: "online", lastSeenAt: at(1) },
      { id: "d2", userId: USER_A, status: "lost", lastSeenAt: at(2) },
      { id: "d3", userId: USER_A, status: "online", lastSeenAt: at(3) },
      { id: "d4", userId: USER_A, status: "locked", lastSeenAt: at(4) },
      { id: "d5", userId: USER_B, status: "online", lastSeenAt: at(5) },
      { id: "d6", userId: USER_B, status: "lost", lastSeenAt: at(6) }
    ];
    for (const row of rows) {
      await createDoc("devices", row.id, {
        userId: row.userId,
        deviceName: row.id,
        platform: "Android",
        status: row.status,
        lastSeenAt: row.lastSeenAt
      } as never);
    }
  });

  it("filters by a single equality field", async () => {
    const { items } = await listDocs("devices", { filters: { userId: USER_A } });
    assert.equal(items.length, 4);
    assert.ok(items.every((d) => d.userId === USER_A));
  });

  it("combines an equality filter with an inequality", async () => {
    const { items } = await listDocs("devices", {
      filters: { userId: USER_A, status: { $ne: "online" } }
    });
    assert.deepEqual(items.map((d) => d._id).sort(), ["d2", "d4"]);
  });

  it("supports `in` for multi-value membership", async () => {
    const { items } = await listDocs("devices", {
      filters: { userId: USER_A, status: { $in: ["online", "locked"] } }
    });
    assert.equal(items.length, 3);
  });

  it("orders descending by a sort field", async () => {
    const { items } = await listDocs("devices", {
      filters: { userId: USER_A },
      order: [{ field: "lastSeenAt", direction: "desc" }]
    });
    assert.deepEqual(items.map((d) => d._id), ["d4", "d3", "d2", "d1"]);
  });

  it("orders ascending", async () => {
    const { items } = await listDocs("devices", {
      filters: { userId: USER_A },
      order: [{ field: "lastSeenAt", direction: "asc" }]
    });
    assert.deepEqual(items.map((d) => d._id), ["d1", "d2", "d3", "d4"]);
  });

  it("honours limit", async () => {
    const { items } = await listDocs("devices", {
      filters: { userId: USER_A },
      order: [{ field: "lastSeenAt", direction: "desc" }],
      limit: 2
    });
    assert.deepEqual(items.map((d) => d._id), ["d4", "d3"]);
  });

  it("excludes the bootstrap sentinel from results", async () => {
    await seedSchemaMarkers();
    const { items } = await listDocs("devices", { filters: { userId: USER_A } });
    assert.equal(items.length, 4);
    assert.ok(!items.some((d) => d._id === SCHEMA_MARKER_ID));
  });

  it("clamps an over-large limit to MAX_PAGE_SIZE", async () => {
    const { items } = await listDocs("devices", { filters: { userId: USER_A }, limit: 10_000 });
    assert.ok(items.length <= MAX_PAGE_SIZE);
  });

  it("falls back to DEFAULT_PAGE_SIZE for a missing limit", async () => {
    const { items } = await listDocs("devices", { filters: { userId: USER_A }, limit: undefined });
    assert.ok(items.length <= DEFAULT_PAGE_SIZE);
  });
});

describe("cursor pagination", () => {
  /** 25 devices so three pages of 10 are required. */
  beforeEach(async () => {
    for (let i = 1; i <= 25; i += 1) {
      await createDoc(
        "devices",
        `p${String(i).padStart(2, "0")}`,
        {
          userId: USER_A,
          deviceName: `Device ${i}`,
          platform: "Android",
          status: "online",
          lastSeenAt: at(i)
        } as never
      );
    }
  });

  const order = [{ field: "lastSeenAt" as const, direction: "asc" as const }];

  it("walks every record exactly once across pages", async () => {
    // This is the property that matters: cursor pagination that drops or
    // duplicates a record is silent -- totals still look plausible.
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;

    do {
      const page: ListResult<DocOf<"devices">> = await listDocs("devices", {
        filters: { userId: USER_A },
        order,
        limit: 10,
        cursor
      });
      seen.push(...page.items.map((d) => d._id));
      cursor = page.nextCursor;
      pages += 1;
      assert.ok(pages < 10, "pagination failed to terminate");
    } while (cursor);

    assert.equal(seen.length, 25, "every record must appear");
    assert.equal(new Set(seen).size, 25, "no record may appear twice");
    assert.deepEqual(seen, [...seen].sort(), "pages must come back in sort order");
  });

  it("reports hasMore correctly on a full and a partial page", async () => {
    const full = await listDocs("devices", { filters: { userId: USER_A }, order, limit: 10 });
    assert.equal(full.hasMore, true);
    assert.ok(full.nextCursor);

    const everything = await listDocs("devices", { filters: { userId: USER_A }, order, limit: 25 });
    assert.equal(everything.hasMore, false);
    assert.equal(everything.nextCursor, null, "an exhausted result set must return a null cursor");
  });

  it("resumes exactly after the last returned document", async () => {
    const first = await listDocs("devices", { filters: { userId: USER_A }, order, limit: 10 });
    const lastOfFirst = first.items[first.items.length - 1];
    const second = await listDocs("devices", {
      filters: { userId: USER_A },
      order,
      limit: 10,
      cursor: first.nextCursor
    });
    assert.ok(!second.items.some((d) => d._id === lastOfFirst._id), "boundary document must not repeat");
  });

  it("treats a malformed cursor as no cursor rather than throwing", async () => {
    const page = await listDocs("devices", {
      filters: { userId: USER_A },
      order,
      limit: 5,
      cursor: "!!!not-base64!!!"
    });
    assert.equal(page.items.length, 5);
  });
});

describe("counting", () => {
  beforeEach(async () => {
    for (let i = 1; i <= 7; i += 1) {
      await createDoc("devices", `c${i}`, {
        userId: i <= 5 ? USER_A : USER_B,
        deviceName: `c${i}`,
        platform: "Android"
      } as never);
    }
  });

  it("countDocs matches the number of filtered documents", async () => {
    assert.equal(await countDocs("devices"), 7);
    assert.equal(await countDocs("devices", { userId: USER_A }), 5);
  });

  it("countDocs and countDocsByScan agree", async () => {
    // Divergence between the two would mean a dashboard total disagrees with the
    // list it sits above.
    const filters = { userId: USER_A };
    assert.equal(
      await countDocs("devices", filters),
      await countDocsByScan("devices", filters)
    );
  });

  it("countDocsByScan excludes the bootstrap sentinel", async () => {
    await seedSchemaMarkers();
    assert.equal(await countDocsByScan("devices"), 7);
  });

  it("returns 0 when nothing matches", async () => {
    assert.equal(await countDocs("devices", { userId: "ghost" }), 0);
  });
});

describe("updateDoc", () => {
  it("merges without clobbering untouched fields", async () => {
    await createDoc("devices", "u1", {
      userId: USER_A,
      deviceName: "Original",
      platform: "Android"
    } as never);

    await updateDoc("devices", "u1", { deviceName: "Renamed" } as never);

    const doc = await getDocById("devices", "u1");
    assert.equal(doc?.deviceName, "Renamed");
    assert.equal(doc?.userId, USER_A, "untouched fields must survive a patch");
    assert.equal(doc?.platform, "Android");
  });

  it("advances updatedAt but preserves createdAt", async () => {
    await createDoc("devices", "u2", {
      userId: USER_A,
      deviceName: "A",
      platform: "Android"
    } as never);
    const before = await getDocById("devices", "u2");

    await new Promise((resolve) => setTimeout(resolve, 5));
    await updateDoc("devices", "u2", { deviceName: "B" } as never);
    const after = await getDocById("devices", "u2");

    assert.equal(after?.createdAt.getTime(), before?.createdAt.getTime(), "createdAt must not move");
    assert.ok(after!.updatedAt.getTime() >= before!.updatedAt.getTime());
  });
});

describe("upsertDoc", () => {
  it("inserts with createFields when the document is absent", async () => {
    await upsertDoc(
      "wifiNetworks",
      "w1",
      { isTrusted: true } as never,
      { userId: USER_A, networkHash: "h1", isUnsecured: false } as never
    );
    const doc = await getDocById("wifiNetworks", "w1");
    assert.equal(doc?.userId, USER_A, "createFields must apply on insert");
    assert.equal(doc?.isTrusted, true);
  });

  it("does not reapply createFields on update", async () => {
    // Mirrors $setOnInsert: firstDetectedAt must stay at the original sighting.
    await upsertDoc(
      "wifiNetworks",
      "w2",
      { isTrusted: true } as never,
      { userId: USER_A, networkHash: "h2", firstDetectedAt: at(0) } as never
    );
    await upsertDoc("wifiNetworks", "w2", { isTrusted: false } as never, {
      userId: "SHOULD-NOT-APPLY",
      firstDetectedAt: at(999)
    } as never);

    const doc = await getDocById("wifiNetworks", "w2");
    assert.equal(doc?.userId, USER_A);
    assert.equal(doc?.firstDetectedAt.getTime(), at(0).getTime());
    assert.equal(doc?.isTrusted, false);
  });
});

describe("runBatch", () => {
  it("commits the queued writes", async () => {
    // Regression: the previous implementation built a batch, handed it to the
    // callback and never called commit(), so every write was silently dropped
    // while still resolving successfully.
    await runBatch((batch) => {
      batch.set(ref("devices", "b1"), {
        userId: USER_A,
        deviceName: "Batched 1",
        platform: "Android"
      });
      batch.set(ref("devices", "b2"), {
        userId: USER_A,
        deviceName: "Batched 2",
        platform: "Android"
      });
    });

    assert.equal((await getDocById("devices", "b1"))?.deviceName, "Batched 1");
    assert.equal((await getDocById("devices", "b2"))?.deviceName, "Batched 2");
  });

  it("awaits an async callback before committing", async () => {
    await runBatch(async (batch) => {
      await Promise.resolve();
      batch.set(ref("devices", "b3"), {
        userId: USER_A,
        deviceName: "Async batched",
        platform: "Android"
      });
    });
    assert.equal((await getDocById("devices", "b3"))?.deviceName, "Async batched");
  });
});

describe("deletes", () => {
  beforeEach(async () => {
    for (const [id, userId] of [["x1", USER_A], ["x2", USER_A], ["x3", USER_B]] as const) {
      await createDoc("devices", id, { userId, deviceName: id, platform: "Android" } as never);
    }
  });

  it("deleteDoc removes a single document", async () => {
    await deleteDoc("devices", "x1");
    assert.equal(await getDocById("devices", "x1"), null);
    assert.ok(await getDocById("devices", "x2"));
  });

  it("deleteDoc refuses to delete the sentinel", async () => {
    await seedSchemaMarkers();
    await deleteDoc("devices", SCHEMA_MARKER_ID);
    assert.ok(await readRaw("devices", SCHEMA_MARKER_ID), "sentinel must survive");
  });

  it("deleteWhere removes only matching documents and reports the count", async () => {
    const deleted = await deleteWhere("devices", { userId: USER_A });
    assert.equal(deleted, 2);
    assert.equal((await listDocs("devices", {})).items.length, 1);
  });

  it("deleteWhere works on the webChecks alias", async () => {
    // Regression: this key was absent from COLLECTIONS, so the lookup produced
    // collection(undefined) and threw before reaching Firestore.
    await createDoc("webChecks", "w1", {
      userId: USER_A,
      domain: "example.com",
      checkedAt: at(0)
    } as never);

    const deleted = await deleteWhere("webChecks", { userId: USER_A });
    assert.equal(deleted, 1);
  });
});

describe("convenience wrappers", () => {
  it("listDocsBy applies filters and a single sort", async () => {
    for (const [id, minutes] of [["w1", 3], ["w2", 1], ["w3", 2]] as const) {
      await createDoc("securityEvents", id, {
        userId: USER_A,
        eventType: "test",
        severity: "low",
        title: id,
        occurredAt: at(minutes)
      } as never);
    }
    const items = await listDocsBy("securityEvents", { userId: USER_A }, "occurredAt", "asc");
    assert.deepEqual(items.map((d) => d._id), ["w2", "w3", "w1"]);
  });

  it("findOneBy returns a single document or null", async () => {
    await createDoc("securityEvents", "f1", {
      userId: USER_A,
      eventType: "test",
      severity: "low",
      title: "f1",
      occurredAt: at(1)
    } as never);

    const found = await findOneBy("securityEvents", { userId: USER_A });
    assert.equal(found?._id, "f1");
    assert.equal(await findOneBy("securityEvents", { userId: "ghost" }), null);
  });
});

describe("composite index coverage", () => {
  it("serves a multi-field filter plus orderBy without an index error", async () => {
    // The emulator enforces firestore.indexes.json. A missing index surfaces here
    // as a FAILED_PRECONDITION, which is how a deploy-time index omission is
    // caught in CI rather than in production.
    await createDoc("securityEvents", "idx1", {
      userId: USER_A,
      isBlocked: true,
      severity: "high",
      eventType: "malware",
      title: "indexed",
      occurredAt: at(1)
    } as never);

    const { items } = await listDocs("securityEvents", {
      filters: { userId: USER_A, isBlocked: true },
      order: [{ field: "occurredAt", direction: "desc" }]
    });
    assert.equal(items.length, 1);
  });

  it("serves the devices status + lastSeenAt ordering used by the device list", async () => {
    for (const [id, minutes] of [["k1", 1], ["k2", 2]] as const) {
      await createDoc("devices", id, {
        userId: USER_A,
        deviceName: id,
        platform: "Android",
        status: "online",
        lastSeenAt: at(minutes)
      } as never);
    }
    const { items } = await listDocs("devices", {
      filters: { userId: USER_A, status: "online" },
      order: [{ field: "lastSeenAt", direction: "desc" }]
    });
    assert.deepEqual(items.map((d) => d._id), ["k2", "k1"]);
  });
});
