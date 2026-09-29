/**
 * Firestore schema for the ERD in docs/ (Admin, User, Device, AntiTheft,
 * PhishingDetection, VPNConnection, AppPermission, ProtectionSettings,
 * SecurityLog, AuditEvent, AppSession).
 *
 * ── Why every collection is prefixed with `mobile` ─────────────────────────────
 * This project already has a live, server-owned schema of 25 top-level
 * collections (server/src/db/schema.ts) that is written exclusively by the
 * Express API through the Admin SDK. The ERD's collection names `users` and
 * `devices` collide with that live data outright.
 *
 * Writing client-side documents into those same paths would inject
 * unvalidated documents into the dataset the API serves, so the ERD is
 * namespaced instead. Consequences:
 *
 *   - Zero collision with the 25 existing collections. Existing data is
 *     untouched and this change is trivially revertible (delete the subtree).
 *   - `CollectionDocMap` below is the single source of truth; the generic CRUD
 *     factory in ./crud.ts is keyed on it, so a collection that is not
 *     registered here cannot be reached from a service module.
 *
 * ── Why the namespace is a PREFIX and not a path prefix ───────────────────────
 * It is tempting to write these as `mobile/users`, `mobile/devices` and so on.
 * That does not work: a Firestore path must alternate collection/document, so
 * a collection reference must have an ODD number of segments. `mobile/users` has
 * two, and the client SDK refuses it before any network call:
 *
 *   Invalid collection reference. Collection references must have an odd
 *   number of segments, but mobile/users has 2.
 *
 * The phantom `mobile` segment would also have to be a real document ID, since
 * the segment before a collection is always a document. So the namespace is
 * applied to the collection NAME instead -- `mobileUsers`, `mobileDevices` --
 * which keeps every collection at one segment and every document at two.
 *
 * ── Naming ───────────────────────────────────────────────────────────────────
 * The ERD uses SQL snake_case (`user_id`, `created_at`). Firestore documents
 * use camelCase, matching the existing server schema, so the mapping is:
 * `user_id` -> `userId`, `password_hash` -> `passwordHash`, `risk_score` ->
 * `riskScore`, and so on. Primary keys are not stored as fields: the ERD's
 * `user_id` is the Firestore document ID, and `auth.uid` is that same value.
 * That identity is what makes the ownership rules in firestore.rules work.
 *
 * ── Sensitive fields ─────────────────────────────────────────────────────────
 * `passwordHash` is deliberately NOT a field of UserDoc. A document a client
 * can read is a document a user can read, and the user owns their own document
 * -- so an inline hash would be readable by its owner. Hashes instead live in
 * `mobileCredentials/{uid}`, which firestore.rules denies to every client
 * (server-only). See the `credentials` path in COLLECTIONS and SERVER_ONLY.
 */

import {
  Timestamp,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

// ─── Root prefix ──────────────────────────────────────────────────────────────

/** Prefix on every client-owned collection in this schema. See header note. */
export const ROOT = "mobile" as const;

/**
 * Apply the `mobile` namespace to a collection name.
 *
 * Called from the `COLLECTIONS` map only, so the convention is applied uniformly
 * and cannot drift: a collection added later without the prefix will not
 * compile, because the return type is the template literal
 * `` `mobile${Capitalize<Name>}` ``.
 */
function clientCollection<const Name extends string>(
  name: Name
): `mobile${Capitalize<Name>}` {
  return `mobile${name.charAt(0).toUpperCase()}${name.slice(1)}` as `mobile${Capitalize<Name>}`;
}

// ─── Shared value types (from the ERD's implicit enums) ──────────────────────

export type UserRole = "user" | "admin";
export type AntiTheftStatus = "armed" | "triggered" | "locked" | "wiped" | "dismissed";
export type AntiTheftAction =
  | "none"
  | "locate"
  | "lock"
  | "unlock"
  | "wipe"
  | "ring"
  | "alert";
export type ScanStatus = "pending" | "scanning" | "completed" | "failed";
export type ScanResult = "safe" | "suspicious" | "malicious" | "unknown";
export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "failed";
export type PermissionStatus = "granted" | "denied" | "revoked" | "pending";
export type LogSeverity = "info" | "low" | "medium" | "high" | "critical";
export type LogStatus = "open" | "acknowledged" | "resolved" | "ignored";
export type SessionStatus = "active" | "expired" | "terminated";

/** A point on the map. `lat`/`lng` rather than a GeoPoint so it stays JSON-safe. */
export interface GeoPoint {
  lat: number;
  lng: number;
  accuracy?: number | null;
}

// ─── 1. Admin ─────────────────────────────────────────────────────────────────

/**
 * ERD: admin_id (PK), name, email, password_hash, role, created_at, last_login
 *
 * The document ID is the Firebase Auth uid of the admin, so a rules block can
 * read the caller's own admin document to authorise admin-only reads. `email`
 * is unique, enforced by the `adminEmails` collection in firestore.rules rather
 * than by a client-side pre-check (a pre-check is advisory; it races).
 */
export interface AdminDoc {
  name: string;
  email: string;
  role: "superadmin" | "admin" | "moderator";
  createdAt: Date;
  lastLoginAt: Date | null;
}

// ─── 2. User ──────────────────────────────────────────────────────────────────

/** ERD: user_id (PK), name, email (unique), phone, profile_pic, role, is_active, created_at, last_login */
export interface UserDoc {
  name: string;
  email: string;
  phone: string | null;
  profilePic: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  /**
   * The uid of the admin who owns/manages this user (ERD: "One Admin manages
   * many Users"). Null for self-registered accounts.
   */
  adminId: string | null;
}

/**
 * Server-only companion to UserDoc. Denied to all clients by firestore.rules.
 * Holds the ERD's `password_hash`; kept out of UserDoc so the user-owned
 * document stays safe to read from the device.
 */
export interface CredentialDoc {
  userId: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── 3. Device ────────────────────────────────────────────────────────────────

/** ERD: device_id (PK), user_id (FK), device_name, os_type, device_model, device_id_hash, last_seen, is_active, created_at */
export interface DeviceDoc {
  userId: string;
  deviceName: string;
  osType: "iOS" | "Android" | "Web" | "Unknown";
  deviceModel: string;
  /**
   * Stable pseudonymous hardware fingerprint (ERD: `device_id_hash`). Used to
   * recognise a device across reinstalls. Must be a hash -- never a raw
   * IMEID/ANDROID_ID, which is a persistent hardware identifier.
   */
  deviceIdHash: string;
  lastSeen: Date;
  isActive: boolean;
  createdAt: Date;
}

// ─── 4. AntiTheft ─────────────────────────────────────────────────────────────

/** ERD: theft_id (PK), user_id (FK), location, status, action_taken, locked_at, created_at */
export interface AntiTheftDoc {
  userId: string;
  deviceId: string | null;
  location: GeoPoint | null;
  status: AntiTheftStatus;
  actionTaken: AntiTheftAction;
  lockedAt: Date | null;
  createdAt: Date;
}

// ─── 5. PhishingDetection ─────────────────────────────────────────────────────

/** ERD: phishing_id (PK), user_id (FK), url, risk_score, status, scanned_at, result, created_at */
export interface PhishingDetectionDoc {
  userId: string;
  url: string;
  /** 0-100. */
  riskScore: number;
  status: ScanStatus;
  scannedAt: Date | null;
  result: ScanResult | null;
  createdAt: Date;
}

// ─── 6. VPNConnection ─────────────────────────────────────────────────────────

/** ERD: vpn_id (PK), user_id (FK), server_location, connection_status, ip_address, connected_at, disconnected_at, duration */
export interface VPNConnectionDoc {
  userId: string;
  serverLocation: string;
  connectionStatus: ConnectionStatus;
  ipAddress: string | null;
  connectedAt: Date;
  disconnectedAt: Date | null;
  /** Seconds. Null while connected. */
  duration: number | null;
}

// ─── 7. AppPermission ─────────────────────────────────────────────────────────

/** ERD: permission_id (PK), user_id (FK), app_name, permission_type, status, granted_at, revoked_at */
export interface AppPermissionDoc {
  userId: string;
  appName: string;
  permissionType: string;
  status: PermissionStatus;
  grantedAt: Date | null;
  revokedAt: Date | null;
}

// ─── 8. ProtectionSettings ────────────────────────────────────────────────────

/**
 * ERD: settings_id (PK), user_id (FK), biometric_enabled, auto_lock,
 * data_wipe_enabled, backup_enabled, created_at, updated_at
 *
 * One document per user, enforced by a `protectionSettings/{uid}` singleton
 * path in firestore.rules rather than by a client-side check.
 */
export interface ProtectionSettingsDoc {
  userId: string;
  biometricEnabled: boolean;
  autoLock: boolean;
  dataWipeEnabled: boolean;
  backupEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Applied by `upsertProtectionSettings` when no document exists yet. */
export const PROTECTION_SETTINGS_DEFAULTS: Omit<
  ProtectionSettingsDoc,
  "userId" | "createdAt" | "updatedAt"
> = {
  biometricEnabled: false,
  autoLock: true,
  dataWipeEnabled: false,
  backupEnabled: true,
};

// ─── 9. SecurityLog ───────────────────────────────────────────────────────────

/** ERD: log_id (PK), user_id (FK), event_type, description, ip_address, device_info, timestamp, severity, status */
export interface SecurityLogDoc {
  userId: string;
  eventType: string;
  description: string;
  ipAddress: string | null;
  deviceInfo: string | null;
  timestamp: Date;
  severity: LogSeverity;
  status: LogStatus;
}

// ─── 10. AuditEvent ───────────────────────────────────────────────────────────

/** ERD: event_id (PK), admin_id (FK), user_id (FK), action, target, details, timestamp */
export interface AuditEventDoc {
  adminId: string;
  /** The user the action was performed on. Null for system-wide actions. */
  userId: string | null;
  action: string;
  /** Resource identifier the action targeted, e.g. "user:abc123". */
  target: string | null;
  details: Record<string, unknown> | null;
  timestamp: Date;
}

// ─── 11. AppSession ───────────────────────────────────────────────────────────

/** ERD: session_id (PK), user_id (FK), login_time, logout_time, ip_address, device_id (FK), status */
export interface AppSessionDoc {
  userId: string;
  loginTime: Date;
  logoutTime: Date | null;
  ipAddress: string | null;
  deviceId: string | null;
  status: SessionStatus;
}

// ─── Collection paths ─────────────────────────────────────────────────────────

/**
 * ERD collection name -> physical collection, each carrying the `mobile` prefix.
 *
 * The ERD's singular table names are pluralised here (`antiTheft` ->
 * `antiThefts`, `vpnConnection` -> `vpnConnections`) to match Firestore
 * convention and the pluralisation already used by the server schema.
 */
export const COLLECTIONS = {
  admins: clientCollection("admins"),
  adminEmails: clientCollection("adminEmails"),
  users: clientCollection("users"),
  userEmails: clientCollection("userEmails"),
  credentials: clientCollection("credentials"),
  devices: clientCollection("devices"),
  antiThefts: clientCollection("antiThefts"),
  phishingDetections: clientCollection("phishingDetections"),
  vpnConnections: clientCollection("vpnConnections"),
  appPermissions: clientCollection("appPermissions"),
  protectionSettings: clientCollection("protectionSettings"),
  securityLogs: clientCollection("securityLogs"),
  auditEvents: clientCollection("auditEvents"),
  appSessions: clientCollection("appSessions"),
} as const;

export type CollectionKey = keyof typeof COLLECTIONS;

export interface CollectionDocMap {
  admins: AdminDoc;
  adminEmails: { email: string; adminId: string };
  users: UserDoc;
  userEmails: { email: string; userId: string };
  credentials: CredentialDoc;
  devices: DeviceDoc;
  antiThefts: AntiTheftDoc;
  phishingDetections: PhishingDetectionDoc;
  vpnConnections: VPNConnectionDoc;
  appPermissions: AppPermissionDoc;
  protectionSettings: ProtectionSettingsDoc;
  securityLogs: SecurityLogDoc;
  auditEvents: AuditEventDoc;
  appSessions: AppSessionDoc;
}

export type DocOf<K extends CollectionKey> = CollectionDocMap[K];

/**
 * A document plus its Firestore ID.
 *
 * Callers write `DocOf<K>` (no `id`) and read `WithId<DocOf<K>>`. The ID is
 * attached by the CRUD layer in ./crud.ts after the converter has run, rather
 * than being part of the converter's type -- which keeps it out of the write
 * type and stops `id` being written to the document as a field.
 */
export type WithId<T> = T & { id: string };

/**
 * Collections a client must never read or write, whatever the caller passes.
 * `credentials` holds password hashes; the two `*Emails` collections are
 * uniqueness ledgers that would otherwise let a client enumerate which
 * addresses are registered. Enforced in code as defence in depth -- the rules
 * file is the real boundary.
 */
export const SERVER_ONLY: ReadonlySet<CollectionKey> = new Set<CollectionKey>([
  "credentials",
  "userEmails",
  "adminEmails",
]);

// ─── Date converters ──────────────────────────────────────────────────────────
//
// Why this exists. The Firestore SDK hands back `Timestamp` objects, which are
// not JSON-serialisable. On device that means a timestamp cannot be cached with
// AsyncStorage, cannot round-trip through react-query's structural sharing, and
// has to be `.toDate()`d at every call site -- easy to forget, and a silently
// wrong render when you do.
//
// The converters below normalise every declared date field to a plain `Date` on
// read. Writing needs no help: the SDK converts `Date` to `Timestamp` natively,
// which is why the date fields in this file are typed `Date` rather than
// `Timestamp` and why there is no branded-Date helper on the write path.
//
// A `Date` serialises to an ISO-8601 string via JSON.stringify and parses back
// with `new Date(...)`, so cached documents survive a round trip.

/** Coerce a stored Firestore value into a `Date`. */
export function toDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new TypeError(`toDate: unparseable date string ${JSON.stringify(value)}`);
    }
    return parsed;
  }
  throw new TypeError(`toDate: unsupported value of type ${typeof value}`);
}

/**
 * Build a converter for a doc whose date fields are named in `dateFields`.
 *
 * The converter is typed on `DocOf<K>`, not `WithId<DocOf<K>>`: writes supply
 * document fields only, and the CRUD layer attaches the ID to reads.
 */
function makeConverter<K extends CollectionKey>(
  _key: K,
  dateFields: readonly (keyof DocOf<K> & string)[]
): FirestoreDataConverter<DocOf<K>> {
  return {
    toFirestore(value: DocOf<K>): DocumentData {
      return value as DocumentData;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): DocOf<K> {
      // `data()` on a QueryDocumentSnapshot is already a fresh plain object,
      // so mutating it here cannot corrupt the SDK's snapshot cache.
      const data = snapshot.data() as Record<string, unknown>;
      for (const field of dateFields) {
        // `null` is a meaningful stored value in this schema (`lockedAt: null`),
        // so it is preserved rather than coerced.
        if (data[field] !== undefined && data[field] !== null) {
          data[field] = toDate(data[field]);
        }
      }
      return data as DocOf<K>;
    },
  };
}

const CONVERTERS: { [K in CollectionKey]: FirestoreDataConverter<DocOf<K>> } = {
  admins: makeConverter("admins", ["createdAt", "lastLoginAt"]),
  adminEmails: makeConverter("adminEmails", []),
  users: makeConverter("users", ["createdAt", "lastLoginAt"]),
  userEmails: makeConverter("userEmails", []),
  credentials: makeConverter("credentials", ["createdAt", "updatedAt"]),
  devices: makeConverter("devices", ["lastSeen", "createdAt"]),
  antiThefts: makeConverter("antiThefts", ["lockedAt", "createdAt"]),
  phishingDetections: makeConverter("phishingDetections", ["scannedAt", "createdAt"]),
  vpnConnections: makeConverter("vpnConnections", ["connectedAt", "disconnectedAt"]),
  appPermissions: makeConverter("appPermissions", ["grantedAt", "revokedAt"]),
  protectionSettings: makeConverter("protectionSettings", ["createdAt", "updatedAt"]),
  securityLogs: makeConverter("securityLogs", ["timestamp"]),
  auditEvents: makeConverter("auditEvents", ["timestamp"]),
  appSessions: makeConverter("appSessions", ["loginTime", "logoutTime"]),
};

export function converterFor<K extends CollectionKey>(key: K): FirestoreDataConverter<DocOf<K>> {
  return CONVERTERS[key];
}
