/**
 * Direct Firestore access for the E2E suite.
 *
 * Everything here uses the Admin SDK, which bypasses security rules. That is the
 * point: these helpers let a test (a) seed documents the API will not create,
 * (b) assert that a document was *actually persisted* rather than merely echoed
 * back in a response, and (c) truncate state between suites. An HTTP-only suite
 * cannot distinguish "the write landed" from "the handler returned the input".
 */

import "./env";

import assert from "node:assert/strict";

import { getFirestoreDb } from "../../src/config/firestore";
import { COLLECTIONS, SCHEMA_MARKER_ID } from "../../src/db/schema";
import type { CollectionKey } from "../../src/db/schema";

export const PHYSICAL_COLLECTIONS: readonly string[] = Object.values(COLLECTIONS);

function db() {
  return getFirestoreDb();
}

/** Raw write, bypassing the data layer. Does not stamp createdAt/updatedAt. */
export async function seed(
  collection: CollectionKey,
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  await db().collection(COLLECTIONS[collection]).doc(id).set(data, { merge: true });
}

export async function readRaw(
  collection: CollectionKey,
  id: string
): Promise<Record<string, unknown> | null> {
  const snapshot = await db().collection(COLLECTIONS[collection]).doc(id).get();
  return snapshot.exists ? (snapshot.data() as Record<string, unknown>) : null;
}

export async function collectionSize(collection: CollectionKey): Promise<number> {
  const snapshot = await db().collection(COLLECTIONS[collection]).get();
  return snapshot.docs.filter((doc) => doc.id !== SCHEMA_MARKER_ID).length;
}

/**
 * Finds the single document in `collection` whose `field` equals `value`.
 *
 * Necessary because most collections are not keyed by the user id: `Settings`
 * rows are created by `Settings.create({ userId })`, which mints a random
 * document id and stores the user id as a *field*. `findOneAndUpdate` with
 * `upsert: true` behaves the same way. Reading `settings` by the user id as if
 * it were the document id silently returns null, which reads as "the write never
 * happened" and sends you hunting for a bug that is not there.
 *
 * Also filters out the `_schema` sentinel so a bootstrap marker can never
 * masquerade as a real row.
 */
export async function readOneByField(
  collection: CollectionKey,
  field: string,
  value: string
): Promise<Record<string, unknown> | null> {
  const snapshot = await db()
    .collection(COLLECTIONS[collection])
    .where(field, "==", value)
    .limit(2)
    .get();

  const docs = snapshot.docs.filter((doc) => doc.id !== SCHEMA_MARKER_ID);
  if (docs.length === 0) return null;
  if (docs.length > 1) {
    throw new Error(
      `Expected at most one ${collection} document with ${field}="${value}", found ${docs.length}. ` +
        `Uniqueness is probably not enforced in the write path.`
    );
  }
  return docs[0].data() as Record<string, unknown>;
}

/**
 * Deletes every document in every known collection, in 400-document batches.
 *
 * Iterating `COLLECTIONS` (rather than hardcoding names) means a newly added
 * collection is truncated automatically; without this, a leftover document from
 * an earlier suite would silently satisfy a `findOne` and mask a broken filter.
 */
export async function truncateAll(): Promise<void> {
  await Promise.all(
    PHYSICAL_COLLECTIONS.map(async (name) => {
      const snapshot = await db().collection(name).get();
      for (let i = 0; i < snapshot.docs.length; i += 400) {
        const batch = db().batch();
        for (const doc of snapshot.docs.slice(i, i + 400)) {
          batch.delete(doc.ref);
        }
        await batch.commit();
      }
    })
  );
}

/**
 * Writes the `_schema` bootstrap sentinel into every collection, exactly as
 * `npm run db:bootstrap` does. Suites that assert the sentinel is invisible to
 * normal reads need it present.
 */
export async function seedSchemaMarkers(): Promise<void> {
  const now = new Date();
  await Promise.all(
    PHYSICAL_COLLECTIONS.map((name) =>
      db()
        .collection(name)
        .doc(SCHEMA_MARKER_ID)
        .set({ collection: name, schemaVersion: 1, updatedAt: now }, { merge: true })
    )
  );
}

/**
 * Clears a single collection.
 *
 * Used to simulate a partially-populated or pre-migration state without having
 * to reverse-engineer what `createUser` would have written.
 */
export async function truncateCollection(collection: CollectionKey): Promise<void> {
  const name = COLLECTIONS[collection];
  const snapshot = await db().collection(name).get();
  for (let i = 0; i < snapshot.docs.length; i += 400) {
    const batch = db().batch();
    for (const doc of snapshot.docs.slice(i, i + 400)) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }
}

/** Raw merge write, for simulating out-of-band admin/support actions. */
export async function patchRaw(
  collection: CollectionKey,
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  await db().collection(COLLECTIONS[collection]).doc(id).set(data, { merge: true });
}

/** Returns the document id of the single row matching `field === value`. */
export async function idByField(
  collection: CollectionKey,
  field: string,
  value: string
): Promise<string> {
  const snapshot = await db()
    .collection(COLLECTIONS[collection])
    .where(field, "==", value)
    .limit(1)
    .get();
  const doc = snapshot.docs.find((candidate) => candidate.id !== SCHEMA_MARKER_ID);
  assert.ok(doc, `no ${collection} document with ${field}="${value}"`);
  return doc.id;
}

/** Timestamp -> Date, for assertions on hydrated documents. */
export function asDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  throw new Error(`Expected a Date or Firestore Timestamp, received ${typeof value}`);
}
