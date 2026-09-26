import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { getFirestoreDb } from "../config/firestore";

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

function matches<T extends FirestoreDocument>(document: T, filter: Filter<T>): boolean {
  return Object.entries(filter).every(([field, expected]) => {
    const actual = field === "_id" ? document._id : document[field];
    if (Array.isArray(expected)) return expected.includes(actual);
    if (expected && typeof expected === "object") {
      const operators = expected as { $in?: unknown[]; $ne?: unknown };
      if (operators.$in) return operators.$in.includes(actual);
      if ("$ne" in operators) return actual !== operators.$ne;
    }
    return normalizeValue(actual) === normalizeValue(expected);
  });
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
    const snapshot = await getFirestoreCollection(this.collection).get();
    let documents = snapshot.docs
      .filter((doc) => doc.id !== "_schema")
      .map((doc) => fromFirestore<T>(this.collection, doc.id, doc.data()));

    documents = documents.filter((document) => this.filters.every((filter) => matches(document, filter)));

    if (this.sortSpec) {
      const [field, direction] = Object.entries(this.sortSpec)[0] as [string, 1 | -1];
      documents.sort((left, right) => {
        const leftValue = left[field];
        const rightValue = right[field];
        if (leftValue === rightValue) return 0;
        return (leftValue! > rightValue! ? 1 : -1) * direction;
      });
    }

    const end = this.limitValue === undefined ? undefined : this.offset + this.limitValue;
    return documents.slice(this.offset, end);
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

function attachDocumentMethods<T extends FirestoreDocument>(collection: FirestoreCollectionKey, document: T): T {
  Object.defineProperty(document, "save", {
    enumerable: false,
    value: async () => {
      await getFirestoreCollection(collection).doc(document._id).set({ ...document }, { merge: true });
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
    const document = attachDocumentMethods(this.collection, { ...data, _id: id, createdAt: data.createdAt ?? now, updatedAt: now } as T);
    await getFirestoreCollection(this.collection).doc(id).set(document);
    return document;
  }

  async insertMany(data: Array<Partial<T>>): Promise<T[]> {
    return Promise.all(data.map((item) => this.create(item)));
  }

  async countDocuments(filter: Filter<T> = {}): Promise<number> {
    return (await this.find(filter)).length;
  }

  async findOneAndUpdate(filter: Filter<T>, update: Update<T>, options: { new?: boolean; upsert?: boolean } = {}): Promise<T | null> {
    const existing = await this.findOne(filter);
    if (!existing && !options.upsert) return null;
    const updateRecord = update as Update<T> & { $setOnInsert?: Partial<T> };
    const next = {
      ...((existing ?? filter) as object),
      ...(("$set" in updateRecord ? updateRecord.$set : updateRecord) as object),
      ...(existing ? {} : (updateRecord.$setOnInsert ?? {})),
    } as Partial<T>;
    return this.create({ ...next, _id: existing?._id } as Partial<T>);
  }

  async findOneAndDelete(filter: Filter<T>): Promise<T | null> {
    const current = await this.findOne(filter);
    if (!current) return null;
    await getFirestoreCollection(this.collection).doc(current._id).delete();
    return current;
  }

  async updateOne(filter: Filter<T>, update: Update<T>): Promise<void> {
    const current = await this.findOne(filter);
    if (!current) return;
    const data = "$set" in update ? update.$set : update;
    await getFirestoreCollection(this.collection).doc(current._id).set({ ...(data as object), updatedAt: new Date() }, { merge: true });
  }

  async deleteOne(filter: Filter<T>): Promise<{ deletedCount: number }> {
    const deleted = await this.findOneAndDelete(filter);
    return { deletedCount: deleted ? 1 : 0 };
  }

  async deleteMany(filter: Filter<T>): Promise<{ deletedCount: number }> {
    const documents = await this.find(filter);
    await Promise.all(documents.map((document) => getFirestoreCollection(this.collection).doc(document._id).delete()));
    return { deletedCount: documents.length };
  }

  async updateMany(filter: Filter<T>, update: Update<T>): Promise<{ modifiedCount: number }> {
    const documents = await this.find(filter);
    const data = "$set" in update ? update.$set : update;
    await Promise.all(
      documents.map((document) =>
        getFirestoreCollection(this.collection).doc(document._id).set(
          { ...(data as object), updatedAt: new Date() },
          { merge: true }
        )
      )
    );
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
