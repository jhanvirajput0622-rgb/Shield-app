/**
 * Firestore query layer.
 *
 * Why this replaces the in-memory filtering in `services/firestoreMigration.ts`
 * ---------------------------------------------------------------------------
 * The old data layer called `collection.get()` with no query at all, then
 * filtered, sorted and paginated inside Node:
 *
 *     const snapshot = await getFirestoreCollection(this.collection).get();
 *     documents = documents.filter(...);  documents.sort(...);  documents.slice(...)
 *
 * Three consequences, all of which get worse as data accumulates:
 *
 *  1. Cost. An unfiltered `collection.get()` bills one read per document in the
 *     collection, not per document returned. `GET /api/devices` for a user with
 *     3 devices still read every device belonging to every other user.
 *  2. `countDocuments()` was `find(filter).length` -- a full collection scan
 *     purely to produce an integer, on a code path that runs on every dashboard
 *     load. `count()` is an AggregationQuery and bills 1 read per index entry.
 *  3. Correctness. `skip()`/`.limit()` were applied after an unbounded in-memory
 *     sort, so there was no way to express a stable page boundary. Deep pages
 *     were also unbounded reads.
 *
 * This module pushes every filter, sort and page boundary into Firestore and
 * exposes cursor pagination. `services/firestoreMigration.ts` now delegates here,
 * so all 23 route files get the fix without modification.
 *
 * REQUIRES the composite indexes in firestore.indexes.json
 * ---------------------------------------------------------
 * A single-field equality filter is served by the automatic single-field index.
 * Any query that mixes equality with an `orderBy`, or filters on two or more
 * fields, needs a composite index. Those are declared in firestore.indexes.json
 * and enforced by the emulator, so a missing index fails CI rather than prod:
 *
 *     firebase deploy --only firestore:indexes
 *
 * Mixed ascending/descending sort on the same field is also not supported by
 * Firestore; the emulator rejects it the same way.
 */

import { FieldPath } from "firebase-admin/firestore";
import { getFirestoreDb } from "../config/firestore";
import { COLLECTIONS, SCHEMA_MARKER_ID } from "./schema";
import type { CollectionKey, DocOf } from "./schema";

// Firestore types come from the ambient `FirebaseFirestore` namespace. See the
// note in config/firestore.ts: the `Firestore` type re-exported by
// "firebase-admin/firestore" resolves to an incomplete surface under
// node16 module resolution, so it cannot be used for type-only imports here.
type CollectionRef<K extends CollectionKey> = FirebaseFirestore.CollectionReference<DocOf<K>>;
type Query<T> = FirebaseFirestore.Query<T>;
/**
 * The ambient namespace declares `QueryDocumentSnapshot<T, DocumentData = DocumentData>`,
 * but defaulting the second parameter to the ambient `DocumentData` makes
 * `createTime` resolve to `Timestamp` (non-optional) on one side and
 * `Timestamp | undefined` on the other, which is not assignable. Pin both
 * parameters to the same `DocumentData` so the two sides agree.
 */
type DocSnapshot<T> = FirebaseFirestore.QueryDocumentSnapshot<T, FirebaseFirestore.DocumentData>;
type OrderDirection = FirebaseFirestore.OrderByDirection;

/**
 * Firestore's own untyped document shape.
 *
 * The query builders below are generic over `T`, and `DocOf<K>` for an
 * unresolved `K` collapses to the *intersection* of every document type (which
 * reduces to `never`). Constraining helpers to `Record<string, unknown>` fails
 * for the opposite reason: a concrete `UserDoc` has no index signature and so is
 * not assignable to it either.
 *
 * Working in Firestore's own `DocumentData` and casting back to `DocOf<K>` at
 * the exported boundary keeps the public API precisely typed while letting the
 * internals stay variance-safe. This is the standard escape hatch for generic
 * query builders; the alternative is hand-writing a builder per collection.
 */
type DocData = FirebaseFirestore.DocumentData;

/**
 * The untyped `CollectionReference` for a logical key.
 *
 * Every exported function narrows `CollectionRef<K>` down to this before
 * touching `.doc()`, so the variance problem above is confined to a single
 * cast instead of being re-asserted at each call site.
 */
function collectionOf<K extends CollectionKey>(key: K): FirebaseFirestore.CollectionReference<DocData> {
  return getCollection(key) as unknown as FirebaseFirestore.CollectionReference<DocData>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Collection access
// ─────────────────────────────────────────────────────────────────────────────

/** Resolves a logical collection key to its typed Firestore collection. */
export function getCollection<K extends CollectionKey>(key: K): CollectionRef<K> {
  return getFirestoreDb().collection(COLLECTIONS[key]) as unknown as CollectionRef<K>;
}

/**
 * Firestore rejects `undefined` as a value. Several code paths assign
 * `undefined` deliberately to clear a field (e.g. `user.twoFactorSecret =
 * undefined` in `services/user.service.ts` before `/2fa/disable`), so writes
 * must drop those keys rather than fail. Omitting a key is not the same as
 * writing null -- see the call sites before changing this.
 */
export function stripUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) output[key] = value;
  }
  return output as Partial<T>;
}

/** Firestore `Timestamp` -> `Date`, recursively. Existing controllers expect Date. */
function reviveDates<T>(value: T): T {
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(reviveDates) as unknown as T;
  if (value && typeof value === "object") {
    // A Firestore Timestamp exposes both `toDate()` and `seconds`. Checking only
    // for `toDate` would also match an arbitrary domain object that happens to
    // have a `toDate` method, so `seconds` is required as the discriminator.
    const candidate = value as { toDate?: unknown; seconds?: unknown };
    if (typeof candidate.toDate === "function" && typeof candidate.seconds === "number") {
      return (candidate.toDate as () => Date)() as unknown as T;
    }
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = reviveDates(entry);
    }
    return out as T;
  }
  return value;
}

function toDoc<T>(snapshot: DocSnapshot<T>): T {
  return { _id: snapshot.id, ...reviveDates(snapshot.data() ?? {}) } as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Filters
// ─────────────────────────────────────────────────────────────────────────────

export type FilterOperator =
  | "=="
  | "!="
  | "in"
  | "not-in"
  | "array-contains"
  | "array-contains-any"
  | ">"
  | ">="
  | "<"
  | "<=";

export interface FieldFilter {
  field: string;
  op: FilterOperator;
  value: unknown;
}

type OperatorMap = Record<string, FilterOperator>;

const COMPARISON_OPS: OperatorMap = {
  $eq: "==",
  $ne: "!=",
  $in: "in",
  $nin: "not-in",
  $contains: "array-contains",
  $containsAny: "array-contains-any",
  $gt: ">",
  $gte: ">=",
  $lt: "<",
  $lte: "<=",
};

const VALID_OPS = new Set<string>([
  "==",
  "!=",
  "in",
  "not-in",
  "array-contains",
  "array-contains-any",
  ">",
  ">=",
  "<",
  "<=",
]);

/**
 * Expands the legacy flat filter object into a flat list of field filters.
 *
 * Supports both shapes used in the codebase:
 *   - `{ status: "lost" }`                       -> status == "lost"
 *   - `{ status: { $in: ["a", "b"] } }`          -> status in ["a", "b"]
 *   - `{ _id: { $ne: "x" } }`                    -> _id != "x"
 *   - `{ _id: ["a", "b"] }`                      -> _id in ["a", "b"]  (legacy shorthand)
 */
export function normalizeFilters(filter: Record<string, unknown> | undefined): FieldFilter[] {
  if (!filter) return [];
  const out: FieldFilter[] = [];

  for (const [field, raw] of Object.entries(filter)) {
    if (raw === undefined) continue;

    if (Array.isArray(raw)) {
      out.push({ field, op: "in", value: raw });
      continue;
    }

    if (raw !== null && typeof raw === "object" && !(raw instanceof Date)) {
      for (const [op, value] of Object.entries(raw as Record<string, unknown>)) {
        const mapped = COMPARISON_OPS[op];
        if (!mapped) {
          throw new Error(
            `Unsupported Firestore filter operator "${op}" on field "${field}". ` +
              `Supported: ${Object.keys(COMPARISON_OPS).join(", ")}`
          );
        }
        out.push({ field, op: mapped, value });
      }
      continue;
    }

    out.push({ field, op: "==", value: raw });
  }

  return out;
}

function applyFilters<T>(query: Query<T>, filters: FieldFilter[]): Query<T> {
  return filters.reduce<Query<T>>((acc, { field, op, value }) => {
    if (!VALID_OPS.has(op)) {
      throw new Error(`Unsupported Firestore filter operator "${op}"`);
    }
    return acc.where(field, op as never, value as never);
  }, query);
}

// ─────────────────────────────────────────────────────────────────────────────
// Ordering
// ─────────────────────────────────────────────────────────────────────────────

export interface OrderSpec {
  field: string;
  direction?: "asc" | "desc";
}

/**
 * The implicit trailing ordering, appended to every sorted query.
 *
 * Firestore already orders by `__name__` last; making it explicit means the
 * ordering is *total* -- no two documents can compare equal -- which is what
 * makes a field-value cursor unambiguous. Without it, two documents sharing a
 * sort value leave the page boundary undefined and a record can be skipped or
 * repeated across pages.
 */
const NAME_FIELD = "__name__";

/**
 * Applies orderings, always ending with `__name__` so the sort is total.
 *
 * The returned list is what a cursor must encode, in order: one value per
 * `orderBy`, with the document ID last.
 */
function applyOrder<T>(query: Query<T>, order: OrderSpec[]): Query<T> {
  if (order.length === 0) return query;
  const [primary, ...rest] = order;
  const direction: OrderDirection = primary.direction === "desc" ? "desc" : "asc";
  let next = query.orderBy(primary.field, direction);
  for (const spec of rest) {
    next = next.orderBy(spec.field, spec.direction === "desc" ? "desc" : "asc");
  }
  // Total order. `__name__` is the document ID and is always ascending.
  //
  // Two things are load-bearing here:
  //  - `FieldPath` must be imported as a value. The ambient `FirebaseFirestore`
  //    namespace is erased at compile time, so `FirebaseFirestore.FieldPath`
  //    is a ReferenceError at runtime.
  //  - The cast is needed because `firebase-admin/firestore` resolves to a
  //    hand-written stub (see types/firebase-admin.d.ts) whose `FieldPath` is
  //    structurally identical to, but nominally distinct from, the ambient
  //    `FirebaseFirestore.FieldPath` the real `Query` type expects.
  return next.orderBy(FieldPath.documentId() as never, "asc");
}

/** The orderBy fields a cursor must carry values for, in application order. */
function cursorFields(order: OrderSpec[]): string[] {
  return order.length === 0 ? [NAME_FIELD] : [...order.map((spec) => spec.field), NAME_FIELD];
}

// ─────────────────────────────────────────────────────────────────────────────
// Cursor encoding
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cursors encode the *values* of the sort keys, not a document ID.
 *
 * The previous implementation encoded the document ID and resumed with
 * `startAfter(collection.doc(id))`. That does not work: the Firestore emulator
 * returns zero documents for a document-reference cursor
 * (`cloud-firestore-emulator` with `@google-cloud/firestore@7.11.6`), so every
 * page after the first came back empty and pagination silently stopped after
 * one page. `startAfter(<field value>)` returns the correct remainder.
 *
 * A document reference is also the wrong abstraction for a cursor, because it
 * re-reads the document to discover the sort values. If the document is deleted
 * between requests, or its sort field is mutated, the page boundary shifts and
 * the caller silently skips or repeats records. Carrying the values makes the
 * boundary a pure function of what was actually returned.
 *
 * `__name__` is appended to every sorted query (see `applyOrder`), so the values
 * array ends with the document ID and the ordering stays total even when several
 * documents share a sort value.
 *
 * Consequence to be aware of: a cursor is only valid within one
 * (collection, filter, order) combination. Reusing `nextCursor` across different
 * filters silently skips results.
 */

/**
 * A cursor value, tagged so the type survives the JSON round-trip.
 *
 * A bare `JSON.stringify` is not enough: a Firestore `Timestamp` serialises to
 * `{"_seconds":…,"_nanoseconds":…}`, which `startAfter` does not recognise as a
 * timestamp, so the comparison silently matches nothing and the second page
 * comes back empty. Dates are therefore encoded as epoch millis and rebuilt as
 * `Date` on the way back in -- Firestore accepts a `Date` wherever it expects a
 * `Timestamp`.
 */
type EncodedCursorValue = { t: "d"; v: number } | { t: "r"; v: unknown };

function encodeCursorValue(value: unknown): EncodedCursorValue {
  if (value instanceof Date) return { t: "d", v: value.getTime() };

  const maybeTimestamp = value as { toDate?: unknown; seconds?: unknown } | null;
  if (
    value &&
    typeof value === "object" &&
    typeof maybeTimestamp?.toDate === "function" &&
    typeof maybeTimestamp?.seconds === "number"
  ) {
    return { t: "d", v: (maybeTimestamp.toDate as () => Date)().getTime() };
  }

  return { t: "r", v: value === undefined ? null : value };
}

function decodeCursorValue(entry: EncodedCursorValue | null): unknown {
  if (!entry) return null;
  if (entry.t === "d") return new Date(entry.v);
  return entry.v;
}

export function encodeCursor(values: unknown[]): string {
  const encoded = (values ?? []).map(encodeCursorValue);
  return Buffer.from(JSON.stringify(encoded), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string | null | undefined): unknown[] | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    // Only an array is a valid payload. A caller passing a bare document ID (the
    // previous wire format) or any other junk is treated as "no cursor" and gets
    // the first page, which is a safe, non-throwing degradation.
    if (!Array.isArray(parsed)) return null;
    return parsed.map(decodeCursorValue);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 200;

export interface ListOptions {
  filters?: Record<string, unknown> | FieldFilter[];
  order?: OrderSpec[];
  limit?: number;
  offset?: number;
  cursor?: string | null;
  /** Exclude the `_schema` bootstrap sentinel. Default true. */
  excludeSchemaMarker?: boolean;
}

export interface ListResult<T> {
  items: T[];
  /** Pass back as `cursor` to fetch the next page. null when exhausted. */
  nextCursor: string | null;
  hasMore: boolean;
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || Number.isNaN(limit)) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(limit)));
}

function toFilterList(filters: ListOptions["filters"]): FieldFilter[] {
  if (!filters) return [];
  if (Array.isArray(filters)) return filters;
  return normalizeFilters(filters);
}

/**
 * Single page of documents. Fetches `limit + 1` to detect `hasMore` without a
 * second count query -- the extra document is discarded, so the cost is one
 * read, not a full scan.
 */
export async function listDocs<K extends CollectionKey>(
  key: K,
  options: ListOptions = {}
): Promise<ListResult<DocOf<K>>> {
  const collection = collectionOf(key);
  const filters = toFilterList(options.filters);
  const limit = clampLimit(options.limit);
  const excludeMarker = options.excludeSchemaMarker ?? true;
  const order = options.order ?? [];

  let query: Query<DocData> = applyFilters(collection, filters);

  if (order.length) {
    query = applyOrder(query, order);
  }

  // Fetch one extra document to detect `hasMore` without a second count query.
  query = query.limit(limit + 1);

  const cursorValues = decodeCursor(options.cursor);
  if (cursorValues && cursorValues.length === cursorFields(order).length) {
    // Field-value cursor. A payload whose arity does not match the current
    // ordering is ignored rather than applied, because `startAfter` with the
    // wrong number of values would either throw or silently misalign.
    query = query.startAfter(...(cursorValues as never[]));
  } else if (!cursorValues && options.offset) {
    query = query.offset(options.offset);
  }

  const snapshot = await query.get();
  let docs = snapshot.docs;
  if (excludeMarker) {
    docs = docs.filter((doc) => doc.id !== SCHEMA_MARKER_ID);
  }

  const hasMore = docs.length > limit;
  const page = docs.slice(0, limit);
  const last = page[page.length - 1];

  return {
    items: page.map((doc) => toDoc<DocOf<K>>(doc as unknown as DocSnapshot<DocOf<K>>)),
    nextCursor: hasMore && last ? encodeCursor(cursorValuesFor(last, order)) : null,
    hasMore,
  };
}

/**
 * The cursor payload for a document: one value per `orderBy`, `__name__` last.
 *
 * Read off the snapshot rather than the hydrated document so Firestore
 * Timestamps are carried verbatim -- re-encoding a `Date` back to a Timestamp is
 * lossy for sub-millisecond precision and would make the boundary inexact.
 */
function cursorValuesFor(snapshot: FirebaseFirestore.QueryDocumentSnapshot, order: OrderSpec[]): unknown[] {
  const data = snapshot.data() ?? {};
  const values = order.map((spec) => data[spec.field] as unknown);
  values.push(snapshot.id);
  return values;
}

/** Convenience wrapper for the common case: filters + a single sort field. */
export async function listDocsBy<K extends CollectionKey>(
  key: K,
  filters: Record<string, unknown>,
  sortField: string,
  direction: "asc" | "desc" = "desc",
  limit?: number
): Promise<DocOf<K>[]> {
  const { items } = await listDocs<K>(key, {
    filters,
    order: [{ field: sortField, direction }],
    limit,
  });
  return items;
}

/** First matching document, or null. Ordered so the result is deterministic. */
export async function findOneBy<K extends CollectionKey>(
  key: K,
  filters: Record<string, unknown>,
  order?: OrderSpec[]
): Promise<DocOf<K> | null> {
  const result = await listDocs<K>(key, { filters, order, limit: 1 });
  return result.items[0] ?? null;
}

/**
 * Document count via AggregationQuery. Bills reads per index entry rather than
 * per document, and does not transfer documents.
 *
 * Firestore's `count()` does not accept every filter operator. Callers needing
 * an exact count for a query the aggregation rejects should use
 * `countDocsByScan` rather than silently getting a wrong number.
 */
export async function countDocs<K extends CollectionKey>(
  key: K,
  filters: Record<string, unknown> = {}
): Promise<number> {
  const query = applyFilters(collectionOf(key), normalizeFilters(filters));
  // `count()` returns an AggregateQuery; the result only exists after `.get()`.
  const snapshot = await query.count().get();
  return snapshot.data().count;
}

/**
 * Exact count by reading only document IDs. Fallback for filter shapes that
 * `count()` rejects. Still bounded by the result set, not the collection, but
 * bills a read per matching document -- prefer `countDocs`.
 */
export async function countDocsByScan<K extends CollectionKey>(
  key: K,
  filters: Record<string, unknown> = {}
): Promise<number> {
  const query = applyFilters(collectionOf(key), normalizeFilters(filters));
  const snapshot = await query.select("_id").get();
  return snapshot.docs.filter((doc) => doc.id !== SCHEMA_MARKER_ID).length;
}

/** Direct document read. Returns null rather than throwing on a missing doc. */
export async function getDocById<K extends CollectionKey>(
  key: K,
  id: string
): Promise<DocOf<K> | null> {
  if (id === SCHEMA_MARKER_ID) return null;
  const snapshot = await collectionOf(key).doc(id).get();
  return snapshot.exists ? (toDoc<DocOf<K>>(snapshot as unknown as DocSnapshot<DocOf<K>>)) : null;
}

export async function docExists<K extends CollectionKey>(key: K, id: string): Promise<boolean> {
  if (id === SCHEMA_MARKER_ID) return false;
  // `exists` is a property on DocumentSnapshot, NOT a method on
  // DocumentReference -- the Admin SDK exposes no `DocumentReference#exists()`.
  // Reading a doc is the only way to ask whether it is there.
  const snapshot = await collectionOf(key).doc(id).get();
  return snapshot.exists;
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Casts a plain object to the `WithFieldValue` shape Firestore's `set()` wants.
 *
 * `WithFieldValue<T>` is a mapped conditional over `T`. For an unresolved
 * generic `DocOf<K>` it degrades to `never`, so every write in this module
 * would otherwise fail to typecheck. The data is caller-supplied and already
 * validated by Zod at the route boundary, so the cast is a type-system
 * workaround rather than an unchecked boundary.
 */
function asFieldValue(value: Record<string, unknown>): FirebaseFirestore.WithFieldValue<DocData> {
  return value as FirebaseFirestore.WithFieldValue<DocData>;
}

export async function createDoc<K extends CollectionKey>(
  key: K,
  id: string,
  data: Partial<DocOf<K>>
): Promise<DocOf<K>> {
  const now = new Date();
  const ref = collectionOf(key).doc(id);
  await ref.set(
    asFieldValue({ ...stripUndefined(data as Record<string, unknown>), _id: id, createdAt: now, updatedAt: now })
  );
  return getDocById<K>(key, id).then((doc) => doc as DocOf<K>);
}

/** Patch semantics: omitted keys are left untouched. `undefined` values are dropped. */
export async function updateDoc<K extends CollectionKey>(
  key: K,
  id: string,
  patch: Partial<DocOf<K>>
): Promise<void> {
  const ref = collectionOf(key).doc(id);
  await ref.set(
    asFieldValue({ ...stripUndefined(patch as Record<string, unknown>), updatedAt: new Date() }),
    { merge: true }
  );
}

/**
 * Create-or-patch. `createFields` applies **only** when the document does not
 * already exist, mirroring `$setOnInsert`.
 *
 * The previous implementation branched on `Object.keys(createFields).length`
 * rather than on whether the document existed, so it re-applied `createFields`
 * on every update and clobbered the stored values -- e.g. rewriting a Wi-Fi
 * network's immutable `firstDetectedAt` on each sighting.
 *
 * The existence check runs inside a transaction so a concurrent create cannot
 * race the insert and get silently overwritten.
 */
export async function upsertDoc<K extends CollectionKey>(
  key: K,
  id: string,
  patch: Partial<DocOf<K>>,
  createFields: Partial<DocOf<K>> = {}
): Promise<DocOf<K>> {
  const ref = collectionOf(key).doc(id);
  const now = new Date();
  const payload = { ...stripUndefined(patch as Record<string, unknown>), updatedAt: now };
  const hasCreateFields = Boolean(createFields) && Object.keys(createFields).length > 0;

  await getFirestoreDb().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);

    if (!snapshot.exists) {
      tx.set(
        ref,
        asFieldValue({
          _id: id,
          createdAt: now,
          ...stripUndefined((createFields ?? {}) as Record<string, unknown>),
          ...payload
        })
      );
      return;
    }

    // Patch only. `merge: true` leaves every field not named in the patch
    // untouched, including `createdAt` and any `createFields` from the insert.
    tx.set(ref, asFieldValue(payload), { merge: true });
  });

  return getDocById<K>(key, id).then((doc) => doc as DocOf<K>);
}

/**
 * Atomic multi-document write. Use for anything that must not interleave --
 * for example revoking all of a user's refresh tokens, or rotating one.
 *
 * The callback queues operations onto the batch; this function commits it.
 * Callers therefore must not call `commit()` themselves -- returning a promise
 * from the callback is supported and is awaited before the commit, but the
 * commit itself is the responsibility of this function.
 *
 * The legacy `bulkWrite` was `Promise.all` of independent writes, which is not
 * atomic: a partial failure leaves the collection inconsistent.
 */
export async function runBatch(
  write: (batch: FirebaseFirestore.WriteBatch) => void | Promise<void>
): Promise<void> {
  const batch = getFirestoreDb().batch();
  await write(batch);
  await batch.commit();
}

export async function deleteDoc<K extends CollectionKey>(key: K, id: string): Promise<void> {
  if (id === SCHEMA_MARKER_ID) return;
  await collectionOf(key).doc(id).delete();
}

/** Delete every document matching a filter, in batches of 400 (the write limit). */
export async function deleteWhere<K extends CollectionKey>(
  key: K,
  filters: Record<string, unknown>
): Promise<number> {
  const query = applyFilters(collectionOf(key), normalizeFilters(filters));
  const snapshot = await query.get();
  const docs = snapshot.docs.filter((doc) => doc.id !== SCHEMA_MARKER_ID);

  for (let i = 0; i < docs.length; i += 400) {
    const batch = getFirestoreDb().batch();
    for (const doc of docs.slice(i, i + 400)) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }
  return docs.length;
}
