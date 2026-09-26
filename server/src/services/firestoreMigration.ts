import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { FieldValue } from "firebase-admin/firestore";
import { getFirestoreDb } from "../config/firestore";
import { listDocs, countDocs, normalizeFilters, stripUndefined, deleteWhere } from "../db/queries";
import type { OrderSpec } from "../db/queries";
import { SCHEMA_MARKER_ID } from "../db/schema";

export type FirestoreDocument = {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
};

type Filter<T> = Partial<Record<keyof T | "_id", unknown>>;
type Sort<T> = Partial<Record<keyof T | "_id", 1 | -1>>;
type Update<T> = Partial<T> | { $set: Partial<T> };

export const firestoreCollectionMap = {
  users: "users",
  settings: "settings",
  refreshTokens: "refresh_tokens",
  passwordResetTokens: "password_reset_tokens",
  emailOtpChallenges: "email_otp_challenges",
  devices: "devices",
  deviceLocations: "device_locations",
  userKeys: "user_keys",
  userSettings: "user_settings",
  notifications: "notifications",
  auditLogs: "audit_logs",
  securityEvents: "security_events",
  threats: "threats",
  permissionScans: "permission_scans",
  appPermissions: "app_permissions",
  installedApps: "installed_apps",
  appPermissionScans: "app_permission_scans",
  companionAccounts: "companion_accounts",
  companionSessions: "companion_sessions",
  vpnSessions: "vpn_sessions",
  wifiNetworks: "wifi_networks",
  theftCommands: "theft_commands",
  antiTheftCommands: "anti_theft_commands",
  antiTheftLogs: "anti_theft_logs",
  phishingChecks: "web_checks",
  webChecks: "web_checks",
} as const;

export type FirestoreCollectionKey = keyof typeof firestoreCollectionMap;

export async function bootstrapFirestoreCollections(): Promise<void> {
  const now = new Date();
  const collections = [...new Set(Object.values(firestoreCollectionMap))];

  await Promise.all(
    collections.map((collection) =>
      getFirestoreDb().collection(collection).doc("_schema").set(
        {
          collection,
          schemaVersion: 1,
          updatedAt: now,
        },
        { merge: true }
      )
    )
  );
}

function normalizeValue(value: unknown): unknown {
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return value;
}

export class FirestoreQuery<T extends FirestoreDocument> implements PromiseLike<T[]> {
  private readonly filters: Filter<T>[] = [];
  private sortSpec: Sort<T> | undefined;
  private offset = 0;
  private limitValue: number | undefined;

  constructor(private readonly collection: FirestoreCollectionKey) {}

  where(filter: Filter<T>): this {
    this.filters.push(filter);
    return this;
  }

  sort(sortSpec: Sort<T>): this {
    this.sortSpec = sortSpec;
    return this;
  }

  skip(value: number): this {
    this.offset = value;
    return this;
  }

  limit(value: number): this {
    this.limitValue = value;
    return this;
  }

  lean(): this {
    return this;
  }

  select(_fields: string): this {
    return this;
  }

  then<TResult1 = T[], TResult2 = never>(
    onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<T[]> {
    // Filtering, sorting and paging are pushed down into Firestore. The previous
    // implementation issued an unfiltered `collection.get()` and then did all
    // three in Node, which billed a read per document in the whole collection
    // and made `countDocuments` a full scan. See db/queries.ts for details.
    const order: OrderSpec[] = [];
    for (const [field, direction] of Object.entries(this.sortSpec ?? {})) {
      order.push({ field, direction: direction === -1 ? "desc" : "asc" });
    }

    const result = await listDocs(this.collection, {
      filters: this.filters.map((filter) => normalizeFilters(filter as Record<string, unknown>)).flat(),
      order,
      limit: this.limitValue,
      offset: this.offset,
    });

    // `this.collection` is a `FirestoreCollectionKey` union, so `listDocs`
    // resolves `DocOf<K>` to the intersection of every document type, which
    // reduces to `never` and cannot be narrowed back to the caller's `T`. The
    // runtime values are the hydrated documents for the concrete collection, so
    // the cast is recovered through `unknown`.
    return (result.items as unknown as T[]).map((doc) => attachDocumentMethods(this.collection, doc));
  }
}

export class FirestoreSingleQuery<T extends FirestoreDocument> implements PromiseLike<T | null> {
  private readonly query: FirestoreQuery<T>;

  constructor(collection: FirestoreCollectionKey, filter: Filter<T>) {
    this.query = new FirestoreQuery<T>(collection).where(filter).limit(1);
  }

  sort(sortSpec: Sort<T>): this {
    this.query.sort(sortSpec);
    return this;
  }

  lean(): this {
    return this;
  }

  select(_fields: string): this {
    return this;
  }

  then<TResult1 = T | null, TResult2 = never>(
    onfulfilled?: ((value: T | null) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.query.then((documents) => documents[0] ?? null).then(onfulfilled, onrejected);
  }
}

/**
 * Prepares a hydrated document for `set()`.
 *
 * Firestore rejects `undefined` as a value, so a key the caller explicitly set
 * to `undefined` -- e.g. `user.twoFactorSecret = undefined` in
 * `services/user.service.ts` before `/2fa/disable` -- has to be translated.
 * Simply dropping the key would stop the write error but, under `merge: true`,
 * would leave the stored value in place, so the field would never actually be
 * cleared. `FieldValue.delete()` both avoids the error and honours the intent.
 */
function prepareForWrite(document: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(document)) {
    payload[key] = value === undefined ? FieldValue.delete() : value;
  }
  return payload;
}

function attachDocumentMethods<T extends FirestoreDocument>(collection: FirestoreCollectionKey, document: T): T {
  Object.defineProperty(document, "save", {
    enumerable: false,
    value: async () => {
      await getFirestoreCollection(collection)
        .doc(document._id)
        .set(prepareForWrite({ ...document }), { merge: true });
      return document;
    },
  });
  if (typeof document.passwordHash === "string") {
    Object.defineProperty(document, "comparePassword", {
      enumerable: false,
      value: (candidate: string) => bcrypt.compare(candidate, String(document.passwordHash)),
    });
  }
  return document;
}

function fromFirestore<T extends FirestoreDocument>(collection: FirestoreCollectionKey, id: string, data: unknown): T {
  const source = (data ?? {}) as Record<string, unknown>;
  const normalized = Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, normalizeValue(value)])
  );
  return attachDocumentMethods(collection, { _id: id, ...normalized } as T);
}

/** True for the sentinel document written by `db:bootstrap`. */
function isSchemaMarker(id: string): boolean {
  return id === SCHEMA_MARKER_ID;
}

export function getFirestoreCollection(collection: FirestoreCollectionKey) {
  return getFirestoreDb().collection(firestoreCollectionMap[collection]);
}

export class FirestoreModel<T extends FirestoreDocument> {
  constructor(private readonly collection: FirestoreCollectionKey) {}

  find(filter: Filter<T> = {}): FirestoreQuery<T> {
    return new FirestoreQuery<T>(this.collection).where(filter);
  }

  findOne(filter: Filter<T> = {}): FirestoreSingleQuery<T> {
    return new FirestoreSingleQuery<T>(this.collection, filter);
  }

  findById(id: string): FirestoreSingleQuery<T> {
    return new FirestoreSingleQuery<T>(this.collection, { _id: id } as Filter<T>);
  }

  async create(data: Partial<T>): Promise<T> {
    const id = typeof data._id === "string" ? data._id : randomUUID();
    const now = new Date();
    // `undefined` is not a legal Firestore value. Several call sites clear a
    // field by assigning undefined (`user.twoFactorSecret = undefined` in
    // services/user.service.ts), which previously threw at write time.
    const document = stripUndefined({
      ...data,
      _id: id,
      createdAt: data.createdAt ?? now,
      updatedAt: now,
    } as Record<string, unknown>) as Partial<T>;
    await getFirestoreCollection(this.collection).doc(id).set(document);
    return attachDocumentMethods(this.collection, {
      ...document,
      _id: id,
      createdAt: data.createdAt ?? now,
      updatedAt: now,
    } as T);
  }

  async insertMany(data: Array<Partial<T>>): Promise<T[]> {
    return Promise.all(data.map((item) => this.create(item)));
  }

  async countDocuments(filter: Filter<T> = {}): Promise<number> {
    // AggregationQuery rather than a full collection scan. This runs on every
    // dashboard load, so it was the single most expensive read in the app.
    return countDocs(this.collection, filter as Record<string, unknown>);
  }

  async findOneAndUpdate(filter: Filter<T>, update: Update<T>, options: { new?: boolean; upsert?: boolean } = {}): Promise<T | null> {
    const existing = await this.findOne(filter);
    if (!existing && !options.upsert) return null;

    const updateRecord = update as Update<T> & { $setOnInsert?: Partial<T> };
    const patch = ("$set" in updateRecord ? updateRecord.$set : updateRecord) as Record<string, unknown>;
    const id = existing?._id ?? (typeof filter._id === "string" ? filter._id : randomUUID());

    // Merge write. The previous implementation round-tripped through
    // `create()`, which performed a full `set()` and rewrote `createdAt`.
    await getFirestoreCollection(this.collection).doc(id).set(
      {
        ...stripUndefined(patch),
        _id: id,
        ...(existing
          ? {}
          : stripUndefined({
              ...(filter as Record<string, unknown>),
              ...((updateRecord.$setOnInsert ?? {}) as Record<string, unknown>),
            })),
        createdAt: existing?.createdAt ?? new Date(),
        updatedAt: new Date(),
      },
      { merge: true }
    );

    return this.findById(id);
  }

  async findOneAndDelete(filter: Filter<T>): Promise<T | null> {
    const current = await this.findOne(filter);
    if (!current || isSchemaMarker(current._id)) return null;
    await getFirestoreCollection(this.collection).doc(current._id).delete();
    return current;
  }

  async updateOne(filter: Filter<T>, update: Update<T>): Promise<void> {
    const current = await this.findOne(filter);
    if (!current) return;
    const data = ("$set" in update ? update.$set : update) as Record<string, unknown>;
    await getFirestoreCollection(this.collection)
      .doc(current._id)
      .set({ ...stripUndefined(data), updatedAt: new Date() }, { merge: true });
  }

  async deleteOne(filter: Filter<T>): Promise<{ deletedCount: number }> {
    const deleted = await this.findOneAndDelete(filter);
    return { deletedCount: deleted ? 1 : 0 };
  }

  async deleteMany(filter: Filter<T>): Promise<{ deletedCount: number }> {
    const deletedCount = await deleteWhere(this.collection, filter as Record<string, unknown>);
    return { deletedCount };
  }

  async updateMany(filter: Filter<T>, update: Update<T>): Promise<{ modifiedCount: number }> {
    const documents = await this.find(filter);
    const data = stripUndefined(("$set" in update ? update.$set : update) as Record<string, unknown>);
    const now = new Date();

    // Committed in 400-document batches. The previous `Promise.all` of
    // individual writes was unbounded and not atomic: a mid-flight failure left
    // the collection partially updated with no way to tell which.
    for (let i = 0; i < documents.length; i += 400) {
      const batch = getFirestoreDb().batch();
      for (const document of documents.slice(i, i + 400)) {
        batch.set(getFirestoreCollection(this.collection).doc(document._id), { ...data, updatedAt: now }, { merge: true });
      }
      await batch.commit();
    }
    return { modifiedCount: documents.length };
  }

  async bulkWrite(operations: Array<{ updateOne: { filter: Filter<T>; update: Update<T>; upsert?: boolean } }>): Promise<void> {
    await Promise.all(
      operations.map(({ updateOne }) =>
        this.findOneAndUpdate(updateOne.filter, updateOne.update, { upsert: updateOne.upsert, new: true })
      )
    );
  }
}

export function createFirestoreModel<T extends FirestoreDocument>(collection: FirestoreCollectionKey): FirestoreModel<T> {
  return new FirestoreModel<T>(collection);
}

export async function upsertDocument<T extends Record<string, unknown>>(
  collection: FirestoreCollectionKey,
  id: string,
  data: T
): Promise<{ _id: string } & T> {
  const now = new Date();
  await getFirestoreCollection(collection).doc(id).set({ ...data, updatedAt: now }, { merge: true });
  return { _id: id, ...data } as { _id: string } & T;
}

export async function getDocument<T extends Record<string, unknown>>(
  collection: FirestoreCollectionKey,
  id: string
): Promise<(T & { _id: string }) | null> {
  const snapshot = await getFirestoreCollection(collection).doc(id).get();
  return snapshot.exists ? ({ _id: snapshot.id, ...(snapshot.data() as T) }) : null;
}
