/**
 * Generic CRUD layer over the ERD schema in ./schema.ts.
 *
 * Every service module in ./services is a thin binding of `crud()` to a
 * collection key, so converter wiring, ownership filters, keyset pagination and
 * `undefined` stripping are implemented exactly once.
 *
 * Ownership is enforced by firestore.rules (`userId == request.auth.uid`), not
 * here. A client-side `userId` filter reduces read cost and picks up an index;
 * it is not a security control, because a hostile client can drop it. The rules
 * are the boundary.
 */

import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch,
  type CollectionReference,
  type DocumentData,
  type Firestore,
  type Query,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type Unsubscribe,
  type WhereFilterOp,
} from "firebase/firestore";

import {
  COLLECTIONS,
  SERVER_ONLY,
  converterFor,
  type CollectionKey,
  type DocOf,
  type WithId,
} from "./schema";
import { getFirestoreDb } from "../firebase";

/**
 * Firestore rejects `undefined` as a value, so writes are scrubbed first.
 *
 * The return type is preserved rather than widened to
 * `Record<string, unknown>`: widening would force a cast at every `setDoc`
 * call site, and the cast would then be unchecked anyway.
 */
function stripUndefined<T extends object>(input: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

/** Current time, for the `createdAt` / `timestamp` stamp on a new document. */
export function now(): Date {
  return new Date();
}

// ─── Query option types ───────────────────────────────────────────────────────

/** Equality-only filters, so index requirements stay predictable. */
export type Filters<K extends CollectionKey> = Partial<{
  [F in keyof DocOf<K> & string]: DocOf<K>[F] | null;
}>;

export interface OrderBy<K extends CollectionKey> {
  field: keyof DocOf<K> & string;
  direction?: "asc" | "desc";
}

/** One inequality filter, for range queries such as `riskScore >= 70`. */
export interface RangeFilter<K extends CollectionKey> {
  field: keyof DocOf<K> & string;
  op: WhereFilterOp;
  value: unknown;
}

export interface ListOptions<K extends CollectionKey> {
  filters?: Filters<K>;
  ranges?: RangeFilter<K>[];
  orderBy?: OrderBy<K>[];
  limit?: number;
}

export interface Page<K extends CollectionKey> {
  docs: WithId<DocOf<K>>[];
  hasMore: boolean;
  /** Id of the last document returned; pass as `startAfterId` for the next page. */
  lastId: string | null;
}

// ─── Internals ────────────────────────────────────────────────────────────────

function assertClientWritable<K extends CollectionKey>(key: K): void {
  if (SERVER_ONLY.has(key)) {
    throw new Error(
      `crud: "${COLLECTIONS[key]}" is server-only and must not be reached from the client. ` +
        `It holds password hashes or the email uniqueness ledger. See SERVER_ONLY in ` +
        `lib/firestore/schema.ts.`
    );
  }
}

function refFor<K extends CollectionKey>(key: K): CollectionReference<DocOf<K>> {
  return collection(getFirestoreDb(), COLLECTIONS[key]).withConverter(converterFor(key));
}

/** Attach the document ID, which the converter does not carry. */
function withId<K extends CollectionKey>(
  snapshots: readonly QueryDocumentSnapshot<DocOf<K>>[]
): WithId<DocOf<K>>[] {
  return snapshots.map((s) => ({ ...s.data(), id: s.id }) as WithId<DocOf<K>>);
}

function applyConstraints<K extends CollectionKey>(
  ref: CollectionReference<DocOf<K>>,
  options: ListOptions<K>
): Query<DocOf<K>> {
  const constraints: QueryConstraint[] = [];

  for (const [field, value] of Object.entries(options.filters ?? {})) {
    if (value === undefined) continue;
    // `null` is a real stored value here (`lockedAt: null`, `logoutTime: null`),
    // so it is filtered with `==` rather than skipped.
    constraints.push(where(field, "==", value));
  }

  for (const { field, op, value } of options.ranges ?? []) {
    constraints.push(where(field, op, value));
  }

  for (const { field, direction } of options.orderBy ?? []) {
    constraints.push(orderBy(field, direction ?? "asc"));
  }

  return constraints.length > 0 ? query(ref, ...constraints) : query(ref);
}

/**
 * A document reference with the collection's converter attached.
 *
 * `setDoc`/`updateDoc` take a converter on the *reference*, not in their options
 * object -- passing it in options is silently ignored by the type checker, which
 * is how a document ends up written with raw field values while reads go through
 * the converter.
 */
function docRefFor<K extends CollectionKey>(key: K, id: string) {
  return doc(getFirestoreDb(), COLLECTIONS[key], id).withConverter(converterFor(key));
}

function rawDocRef<K extends CollectionKey>(key: K, id: string) {
  return doc(getFirestoreDb(), COLLECTIONS[key], id);
}

// ─── CRUD surface ─────────────────────────────────────────────────────────────

export interface Batch<K extends CollectionKey> {
  set(id: string, data: Partial<DocOf<K>>): void;
  update(id: string, changes: Partial<DocOf<K>>): void;
  remove(id: string): void;
  commit(): Promise<void>;
}

export interface Crud<K extends CollectionKey> {
  readonly key: K;
  readonly path: string;

  /** Create under an explicit document ID. Returns the ID. */
  createWithId(id: string, data: DocOf<K>): Promise<string>;
  /** Create with a Firestore-generated ID. Returns the ID. */
  create(data: DocOf<K>): Promise<string>;
  /** Create or fully replace. */
  set(id: string, data: DocOf<K>): Promise<void>;
  /** Read one document, or `null` when absent. */
  get(id: string): Promise<WithId<DocOf<K>> | null>;
  exists(id: string): Promise<boolean>;
  /** Read several by ID, skipping the ones that do not exist. */
  getMany(ids: string[]): Promise<WithId<DocOf<K>>[]>;
  list(options?: ListOptions<K>): Promise<WithId<DocOf<K>>[]>;
  /**
   * Keyset pagination. Prefer this to `offset`, which bills a read per skipped
   * document and degrades linearly.
   */
  paginate(
    options: ListOptions<K> & { pageSize?: number; startAfterId?: string }
  ): Promise<Page<K>>;
  /**
   * Partial update. A field set to `undefined` is dropped, which does NOT clear
   * a stored value -- name it in `clearFields` to delete it.
   */
  update(
    id: string,
    changes: Partial<DocOf<K>>,
    options?: { clearFields?: (keyof DocOf<K> & string)[] }
  ): Promise<void>;
  /** Create when absent, patch when present. */
  upsert(id: string, data: Partial<DocOf<K>>): Promise<void>;
  /** Atomic multi-document patch, e.g. end a session and write the audit event. */
  batch(): Batch<K>;
  remove(id: string): Promise<void>;
  /** Delete every document matching `filters`. Returns the count removed. */
  removeWhere(filters: Filters<K>): Promise<number>;
  count(filters?: Filters<K>): Promise<number>;
  /**
   * Realtime updates. Every `onSnapshot` in this file needs a matching
   * `allow read` grant in firestore.rules, which is separate from `get`.
   */
  subscribe(
    options: ListOptions<K>,
    onNext: (docs: WithId<DocOf<K>>[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe;
}

/** Build the CRUD surface for one collection. */
export function crud<K extends CollectionKey>(key: K): Crud<K> {
  assertClientWritable(key);

  const path: string = COLLECTIONS[key];
  const ref = refFor(key);
  const docRef = (id: string) => docRefFor(key, id);

  const list = async (options: ListOptions<K> = {}): Promise<WithId<DocOf<K>>[]> => {
    const snapshot = await getDocs(applyConstraints(ref, options));
    return withId(snapshot.docs);
  };

  return {
    key,
    path,

    async createWithId(id, data) {
      await setDoc(docRef(id), stripUndefined(data));
      return id;
    },

    async create(data) {
      // `doc(ref)` allocates the ID client-side, then `setDoc` writes it. The
      // modern equivalent of `add()`, and it lets the caller learn the ID
      // before the write resolves.
      const newRef = doc(ref);
      await setDoc(newRef, stripUndefined(data));
      return newRef.id;
    },

    async set(id, data) {
      await setDoc(docRef(id), stripUndefined(data));
    },

    async get(id) {
      const snapshot = await getDoc(docRef(id));
      return snapshot.exists() ? withId([snapshot])[0] : null;
    },

    async exists(id) {
      return (await getDoc(rawDocRef(key, id))).exists();
    },

    async getMany(ids) {
      if (ids.length === 0) return [];
      const snapshots = await Promise.all(ids.map((id) => getDoc(docRef(id))));
      return withId(snapshots.filter((s) => s.exists()));
    },

    list,

    async paginate(options) {
      const pageSize = options.pageSize ?? 25;
      const constraints: QueryConstraint[] = [];

      for (const [field, value] of Object.entries(options.filters ?? {})) {
        if (value === undefined) continue;
        constraints.push(where(field, "==", value));
      }
      for (const { field, op, value } of options.ranges ?? []) {
        constraints.push(where(field, op, value));
      }
      for (const { field, direction } of options.orderBy ?? []) {
        constraints.push(orderBy(field, direction ?? "asc"));
      }

      if (options.startAfterId) {
        // The cursor is resolved back to its document rather than carried as a
        // field tuple: equal sort values would make a field-based cursor
        // ambiguous and silently skip or repeat rows.
        const cursorSnap = await getDoc(rawDocRef(key, options.startAfterId));
        if (cursorSnap.exists()) constraints.push(startAfter(cursorSnap));
      }

      // One extra document tells us whether another page exists.
      constraints.push(fsLimit(pageSize + 1));

      const snapshot = await getDocs(query(ref, ...constraints));
      const hasMore = snapshot.docs.length > pageSize;
      const page = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;

      return {
        docs: withId(page),
        hasMore,
        lastId: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      };
    },

    async update(id, changes, options) {
      const payload = stripUndefined({ ...changes }) as Record<string, unknown>;
      for (const field of options?.clearFields ?? []) {
        // Dropping the key would leave the stored value in place under
        // `merge`; `deleteField()` is what actually removes it.
        payload[field as string] = deleteField();
      }
      await updateDoc(docRef(id), payload);
    },

    async upsert(id, data) {
      await setDoc(docRef(id), stripUndefined(data), { merge: true });
    },

    batch(): Batch<K> {
      // `writeBatch` has no converter support, so batch writes go through raw
      // references. Values are unaffected: the SDK converts `Date` to
      // `Timestamp` natively, and the converter only rewrites reads.
      const batch = writeBatch(getFirestoreDb());
      const asData = (value: object) => stripUndefined(value) as DocumentData;
      return {
        set(id, data) {
          batch.set(rawDocRef(key, id), asData(data), { merge: true });
        },
        update(id, changes) {
          batch.update(rawDocRef(key, id), asData(changes));
        },
        remove(id) {
          batch.delete(rawDocRef(key, id));
        },
        commit: () => batch.commit(),
      };
    },

    async remove(id) {
      await deleteDoc(rawDocRef(key, id));
    },

    async removeWhere(filters) {
      const found = await list({ filters });
      if (found.length === 0) return 0;

      // 500 writes is the documented per-batch ceiling; chunk to stay under it.
      for (let i = 0; i < found.length; i += 400) {
        const batch = writeBatch(getFirestoreDb());
        for (const d of found.slice(i, i + 400)) {
          batch.delete(rawDocRef(key, d.id));
        }
        await batch.commit();
      }
      return found.length;
    },

    async count(filters) {
      // Aggregate count: billed as a single read regardless of how many
      // documents match. Fetching documents to count them (the obvious
      // implementation) bills one read per document and silently truncates at
      // whatever limit you pick.
      //
      // `getCountFromServer` accepts equality and inequality filters but not
      // `orderBy` or `limit`, so only the filters are applied here.
      const constraints: QueryConstraint[] = [];
      for (const [field, value] of Object.entries(filters ?? {})) {
        if (value === undefined) continue;
        constraints.push(where(field, "==", value));
      }
      const snap = await getCountFromServer(query(ref, ...constraints));
      return snap.data().count;
    },

    subscribe(options, onNext, onError) {
      return onSnapshot(
        applyConstraints(ref, options),
        (snapshot) => onNext(withId(snapshot.docs)),
        (error) => {
          if (onError) {
            onError(error);
            return;
          }
          if (error.code === "permission-denied") {
            console.error(
              `[firestore] subscribe to ${path} denied — check the onSnapshot grant in firestore.rules.`
            );
            return;
          }
          console.error(`[firestore] subscribe to ${path} failed:`, error.message);
        }
      );
    },
  };
}

export type { Firestore };
