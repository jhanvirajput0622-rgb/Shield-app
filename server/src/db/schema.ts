/**
 * Canonical Firestore document schema for Shield.
 *
 * Why this file exists
 * --------------------
 * Every model interface in `models/firestore.ts` except `IUser` and
 * `IAppPermissionScan` was an empty interface extending `FirestoreModelDocument`,
 * which carries `[key: string]: any`. That erased all type information: a typo in
 * a field name, a `string` where a `Date` was expected, or a filter on a field
 * that was never written all compiled cleanly and only failed at runtime.
 *
 * The types below are derived from the actual create/update/filter/sort sites in
 * `routes/`, `controllers/` and `services/`. Fields marked "never written" are
 * declared `never written` in their doc comment because the code *reads* them
 * but nothing ever persists them -- they are latent bugs, not schema. See
 * docs/FIREBASE.md.
 *
 * Conventions
 * -----------
 * - `_id` mirrors the Firestore document ID. The data layer in
 *   `services/firestoreMigration.ts` persists it as a real field for historical
 *   reasons; all filters may use either `_id` or a direct `doc()` read.
 * - `createdAt` / `updatedAt` are injected automatically on create and on every
 *   `$set` write. Do not set them by hand.
 * - `undefined` means "not persisted". Firestore rejects `undefined` in
 *   `set()`/`update()`, so the data layer strips these keys on write.
 * - Optional fields are genuinely optional: several writers omit them (for
 *   example the direct `SecurityEvent.create` call sites drop `metadata`).
 */

import type { Timestamp } from "firebase-admin/firestore";

// ─────────────────────────────────────────────────────────────────────────────
// Shared value types
// ─────────────────────────────────────────────────────────────────────────────

/** Injected on every document by the data layer. Never set these manually. */
export interface BaseDoc {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
}

export type DeviceStatus = "online" | "offline" | "lost" | "locked" | "wiped";
export type PendingAction = "none" | "locate" | "lock" | "wipe";
export type ActionStatus = "idle" | "queued" | "delivered" | "completed" | "failed";
export type EventSeverity = "info" | "low" | "medium" | "high" | "critical";
export type PhishingVerdict = "safe" | "malicious" | "unknown" | "suspicious";
export type PhishingSource = "manual_check" | "auto_scan" | "sms" | "qr";
export type NotificationType = "Alert" | "Info" | "Warning";
export type ThreatSeverity = "Low" | "Medium" | "High" | "Critical";
export type UserRole = "user" | "admin";
export type WifiSecurityType = "WPA3" | "WPA2" | "WPA" | "WEP" | "OPEN" | "UNKNOWN";
export type VpnConnectionStatus = "connecting" | "connected" | "disconnected";
export type TheftCommandType = "locate" | "lock" | "wipe";
export type TheftCommandStatus =
  | "pending"
  | "sent"
  | "acknowledged"
  | "completed"
  | "failed"
  | "expired";
export type RiskLevel = "safe" | "low" | "medium" | "high" | "critical";
export type Platform = "iOS" | "Android";

// ─────────────────────────────────────────────────────────────────────────────
// users
// ─────────────────────────────────────────────────────────────────────────────

export interface UserDoc extends BaseDoc {
  email: string;
  /** bcrypt, cost 12. Never returned by any controller. */
  passwordHash: string;
  displayName: string;
  /**
   * Duplicates `displayName`; written on every create path. Kept for backwards
   * compatibility with the `name` projection in `routes/users.routes.ts`.
   */
  name: string;
  phoneNumber: string | null;
  /** Google OIDC `sub`. Set only by the Google sign-in path. */
  googleSub: string | null;
  /**
   * Declared and projected by the API, but NEVER written by any code path.
   * Every user therefore has `role === undefined`. Either seed it at registration
   * or delete the field. See docs/FIREBASE.md.
   */
  role?: UserRole;
  /** Projected, never written. Always `undefined`. */
  protectionScore?: number;
  /** Projected, never written. Always `undefined`. */
  isActive?: boolean;
  twoFactorEnabled?: boolean;
  /**
   * otplib base32 TOTP seed, stored in PLAINTEXT.
   *
   * It is written by `/2fa/setup` and is required again on every login that has
   * 2FA enabled (`userService.login` verifies the submitted OTP against it), so
   * it cannot be discarded at verification time -- it is cleared only by
   * `/2fa/disable`.
   *
   * This is a live at-rest exposure: anyone able to read the `users` collection
   * can mint valid codes indefinitely. `ENCRYPTION_KEY` and the AES-256-GCM
   * helper in `services/audit.service.ts` already exist in this codebase and are
   * the natural mechanism to close it. Not changed here because it is a schema
   * and migration decision, not a test-suite fix.
   */
  twoFactorSecret?: string;
  lastLoginAt: Date | null;
  /** Not persisted -- attached per-read by the data layer. */
  comparePassword(candidate: string): Promise<boolean>;
}

// ─────────────────────────────────────────────────────────────────────────────
// settings  (per-user feature toggles; one document per user)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * NOTE: none of the six booleans have defaults. `Settings.create({ userId })`
 * writes `userId` alone, so every flag reads back as `undefined` until the user
 * PATCHes it. Consumers must treat `undefined` as "off"/"default", not `false`.
 */
export interface SettingsDoc extends BaseDoc {
  userId: string;
  webProtectionEnabled?: boolean;
  vpnAutoConnect?: boolean;
  killSwitchEnabled?: boolean;
  notifyHighRiskApps?: boolean;
  notifyPhishingThreats?: boolean;
  notifyDeviceUnlock?: boolean;
}

/**
 * Defaults written whenever a `settings` row is created.
 *
 * Without these, `Settings.create({ userId })` persists a row with none of the
 * six flags set, and `JSON.stringify` then *omits* the undefined keys from
 * `GET /api/shield/settings`. That silently violated the OpenAPI contract:
 * `ShieldSettings` lists all six booleans under `required`
 * (`lib/api-spec/openapi.yaml`), so the generated client in
 * `lib/api-clients-react` types them as `boolean` and receives `undefined`.
 *
 * Protective features default to on; connectivity automation defaults to off,
 * because silently tunnelling a user's traffic is not a safe default.
 */
export const SETTINGS_DEFAULTS: Readonly<
  Pick<
    SettingsDoc,
    | "webProtectionEnabled"
    | "vpnAutoConnect"
    | "killSwitchEnabled"
    | "notifyHighRiskApps"
    | "notifyPhishingThreats"
    | "notifyDeviceUnlock"
  >
> = Object.freeze({
  webProtectionEnabled: true,
  vpnAutoConnect: false,
  killSwitchEnabled: true,
  notifyHighRiskApps: true,
  notifyPhishingThreats: true,
  notifyDeviceUnlock: true,
});

// ─────────────────────────────────────────────────────────────────────────────
// user_settings  (arbitrary string key/value pairs; distinct from `settings`)
// ─────────────────────────────────────────────────────────────────────────────

export interface UserSettingDoc extends BaseDoc {
  userId: string;
  settingKey: string;
  /** Raw string, max 4096 chars. Parsed as JSON by the controller on read. */
  settingValue: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// refresh_tokens  /  password_reset_tokens  /  email_otp_challenges
// ─────────────────────────────────────────────────────────────────────────────

/** Raw token is 64 hex chars; only the sha256 hex digest is persisted. */
export interface RefreshTokenDoc extends BaseDoc {
  userId: string;
  deviceId: string | null;
  /** sha256 hex of the raw token. Indexed. */
  tokenHash: string;
  expiresAt: Date;
  /**
   * Always written (`false` at issue, `true` on revoke).
   *
   * It was previously absent until first use, which broke `logoutAll`: a
   * Firestore equality filter on `revoked == false` does not match a document
   * where the field is missing, so "log out all devices" matched nothing. Reads
   * should still use truthiness rather than `=== false`, so tokens issued before
   * the flag existed are treated as not revoked.
   */
  revoked: boolean;
}

export interface PasswordResetTokenDoc extends BaseDoc {
  userId: string;
  /** sha256 hex. Indexed. Expired tokens are never purged -- see retention below. */
  tokenHash: string;
  expiresAt: Date;
  /** `undefined` until consumed. Treat missing as `false`. */
  used?: boolean;
}

export interface EmailOtpChallengeDoc extends BaseDoc {
  email: string;
  /** HMAC-SHA256 hex of `${email}:${code}`, keyed by OTP_HASH_SECRET. */
  codeHash: string;
  name: string;
  expiresAt: Date;
  /** Drives the 60s resend throttle. */
  lastSentAt: Date;
  /** Max 5. */
  attempts: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// devices  /  device_locations
// ─────────────────────────────────────────────────────────────────────────────

export interface DeviceDoc extends BaseDoc {
  userId: string;
  deviceName: string;
  platform: Platform;
  osVersion: string;
  appVersion: string;
  deviceModel: string;
  /** sha256 of the device public key. Set only via POST /api/devices. */
  deviceKeyFingerprint?: string;
  /** Base64 client key. Set only via POST /api/shield/device/register. */
  publicKey?: string;
  status?: DeviceStatus;
  batteryPercent?: number;
  /** Primary sort key for every device list endpoint. */
  lastSeenAt?: Date;
  locationAvailable?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  locationLabel?: string;
  locationAccuracy?: number | null;
  locationUpdatedAt?: Date;
  pendingAction?: PendingAction;
  actionStatus?: ActionStatus;
  lockMessage?: string;
  // ── The six fields below are projected by controllers/devices.controller.ts
  //    but never written by any code path, so they are always `undefined` and
  //    JSON.stringify drops them from the response. See docs/FIREBASE.md.
  simStatus?: string;
  gpsPrecision?: string;
  networkEncryption?: string;
  isOnline?: boolean;
  vpnEnabled?: boolean;
  theftProtectionEnabled?: boolean;
}

export interface DeviceLocationDoc extends BaseDoc {
  deviceId: string;
  userId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  /** Sort key for the location history endpoint. */
  recordedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// user_keys
// ─────────────────────────────────────────────────────────────────────────────

export interface UserKeyDoc extends BaseDoc {
  userId: string;
  publicKey: string;
  /**
   * Client-supplied ciphertext (the server holds no key capable of decrypting
   * it). Never projected -- the controller maps an explicit field allowlist.
   */
  privateKeyEncrypted: string;
  keyCreatedAt: Date;
  keyUpdatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// security_events  /  audit_logs
// ─────────────────────────────────────────────────────────────────────────────

export interface SecurityEventDoc extends BaseDoc {
  userId: string;
  deviceId: string | null;
  eventType: string;
  severity: EventSeverity;
  title: string;
  /** Defaults to "". */
  description?: string;
  /** Defaults to false. OMITTED ENTIRELY by the direct `create()` writers in
   *  `phishing.service.ts`, `permissionScan.service.ts`, `network.service.ts`
   *  and `wifi.service.ts` -- treat missing as `false`. */
  isBlocked?: boolean;
  /** Defaults to {}. Omitted entirely by those same direct writers. */
  metadata?: Record<string, unknown>;
  /** Sort key. Distinct from `createdAt`; do not conflate the two. */
  occurredAt: Date;
}

export interface AuditLogDoc extends BaseDoc {
  userId: string;
  deviceId: string | null;
  action: string;
  summary: string;
  /**
   * base64 of [iv(12) | tag(16) | ciphertext], AES-256-GCM keyed by
   * ENCRYPTION_KEY. WRITE-ONLY: no decryptor exists anywhere in src/. See
   * docs/FIREBASE.md before relying on this.
   */
  detailsEncrypted: string;
  ipAddress: string;
  userAgent: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// threats  /  notifications
// ─────────────────────────────────────────────────────────────────────────────

export interface ThreatDoc extends BaseDoc {
  isActive: boolean;
  severity: ThreatSeverity;
  threatType: string;
  lastSeenAt: Date;
  // `threats` is a GLOBAL, non-user-scoped feed: `Threat.findById` in
  // controllers/threat.controller.ts performs no ownership check, which is
  // intentional for a shared advisory feed but must not be changed to a
  // user-scoped pattern by accident.
  title?: string;
  description?: string;
  referenceUrl?: string;
}

/**
 * NEVER written by the server -- only read and bulk-updated. Documents must be
 * written by an external process (Cloud Function, admin script, or a future
 * notification service). Because the controller returns whole documents, any
 * additional field is passed through to the client verbatim.
 */
export interface NotificationDoc extends BaseDoc {
  userId: string;
  isRead: boolean;
  title: string;
  message: string;
  type: NotificationType;
}

// ─────────────────────────────────────────────────────────────────────────────
// permission_scans  /  app_permissions  /  installed_apps  /  app_permission_scans
// ─────────────────────────────────────────────────────────────────────────────

/** Legacy per-permission collection. Declared and mapped, but no route or
 *  controller references it. Retained for an older client build. */
export interface PermissionScanDoc extends BaseDoc {
  userId: string;
  deviceId?: string;
  scannedAt: Date;
}

/** Never written by the server. Read-only projection of a device's grants. */
export interface AppPermissionDoc extends BaseDoc {
  userId: string;
  appId: string;
  isDangerous: boolean;
  appName?: string;
  permissions?: string[];
}

/** Never written by the server. Snapshot rows produced by a device scan. */
export interface InstalledAppDoc extends BaseDoc {
  userId: string;
  scanId: string;
  packageName: string;
  appName: string;
  category: string;
  /** 0-100. Sort key. */
  riskScore: number;
  riskLevel: RiskLevel;
  riskReasons: string[];
  requestedPermissions: string[];
}

export interface AppFinding {
  appName: string;
  packageName: string;
  /** Defaults to "unknown". */
  category: string;
  requestedPermissions: string[];
  /** 0-100, clamped by `services/permissionScan.service.ts`. */
  riskScore: number;
  riskLevel: RiskLevel;
  riskReasons: string[];
}

export interface AppPermissionScanDoc extends BaseDoc {
  userId: string;
  deviceId: string;
  apps: AppFinding[];
  totalApps: number;
  highRiskCount: number;
  /** Sort key. */
  scannedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// companion_accounts  /  companion_sessions
// ─────────────────────────────────────────────────────────────────────────────

export interface CompanionAccountDoc extends BaseDoc {
  userId: string;
  email: string;
  passwordHash: string;
  lastLoginAt: Date | null;
  /**
   * NEVER WRITTEN -- always `undefined`. `controllers/companionAccount.controller.ts`
   * rejects login with `forbidden` when this is falsy, so every companion
   * account created through the API can never log in. See docs/FIREBASE.md.
   */
  isActive?: boolean;
  /** Never written. */
  twoFactorEnabled?: boolean;
}

export interface CompanionSessionDoc extends BaseDoc {
  companionId: string;
  userId: string;
  /** Sort key. */
  loginTime: Date;
  ipAddress: string;
  userAgent: string;
  /** Never written -- there is no session-close endpoint. Sessions never expire. */
  logoutTime?: Date | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// vpn_sessions  /  wifi_networks
// ─────────────────────────────────────────────────────────────────────────────

export interface VpnSessionDoc extends BaseDoc {
  userId: string;
  deviceId: string;
  connectionStatus: VpnConnectionStatus;
  localIp: string;
  /** WireGuard | OpenVPN | IPSec */
  protocol: string;
  serverLocation: string;
  /** ChaCha20-Poly1305 | AES-256-GCM | AES-256-CBC */
  encryption: string;
  connectedAt: Date;
  disconnectedAt: Date | null;
  /** `undefined` until the first PATCH; never defaulted at create. */
  bytesUploaded?: number;
  bytesDownloaded?: number;
}

export interface WifiNetworkDoc extends BaseDoc {
  userId: string;
  /** Falls back to a random UUID when the device is unknown (`wifi.service.ts`). */
  deviceId: string;
  /** sha256 of the SSID. Part of the upsert key triple. */
  networkHash: string;
  ssid?: string;
  securityType: WifiSecurityType;
  /** True for OPEN and WEP. */
  isUnsecured: boolean;
  /** -100..0, or null. */
  signalStrength: number | null;
  /** Set only via `$setOnInsert` -- immutable after first sighting. */
  firstDetectedAt: Date;
  /** Sort key. */
  lastDetectedAt: Date;
  isTrusted: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// theft_commands
// ─────────────────────────────────────────────────────────────────────────────

export interface TheftCommandDoc extends BaseDoc {
  userId: string;
  deviceId: string;
  command: TheftCommandType;
  status: TheftCommandStatus;
  /** Lock command only. */
  message?: string;
  /**
   * Sort key. OMITTED by 3 of the 4 creation paths (all except the synchronous
   * locate path), and `controllers/theft.controller.ts` calls
   * `c.issuedAt.toISOString()` unconditionally -- so listing queued commands
   * throws a TypeError today. See docs/FIREBASE.md.
   */
  issuedAt?: Date;
  completedAt?: Date | null;
  /** Never written. */
  acknowledgedAt?: Date | null;
  /** Never written. */
  expiresAt?: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// anti_theft_commands  /  anti_theft_logs
// ─────────────────────────────────────────────────────────────────────────────

/** Declared and mapped, but no route or controller references it. The active
 *  anti-theft path writes to `theft_commands` and `devices` instead. */
export interface AntiTheftCommandDoc extends BaseDoc {
  userId: string;
  deviceId: string;
  command: string;
  status: string;
  issuedAt?: Date;
}

/** Declared and mapped, but no route or controller references it. */
export interface AntiTheftLogDoc extends BaseDoc {
  userId: string;
  deviceId: string;
  action: string;
  result: string;
  performedAt?: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// web_checks  (the phishing URL check log)
// ─────────────────────────────────────────────────────────────────────────────

export interface WebCheckDoc extends BaseDoc {
  userId: string;
  deviceId: string;
  /** sha256 of the URL. Written but never filtered on. */
  urlHash: string;
  /**
   * Client-supplied ciphertext -- the server cannot decrypt it. `.select("-encryptedUrl")`
   * in the controllers is a NO-OP, so this field is excluded only because the
   * controllers map an explicit field allowlist. Any response that returns the raw
   * document leaks it. See docs/FIREBASE.md.
   */
  encryptedUrl: string;
  domain: string;
  verdict: PhishingVerdict;
  threatType: string | null;
  source: PhishingSource;
  /** Sort key. */
  checkedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Collection registry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Logical collection key -> physical Firestore collection path.
 *
 * The keys are camelCase and match the model names in `models/firestore.ts`; the
 * values are the snake_case collections that actually exist in the project.
 * Always resolve through `getCollection()` in `db/firestore.ts` -- never call
 * `db.collection("...")` with a hardcoded string, or you will break the mapping.
 */
export const COLLECTIONS = {
  users: "users",
  settings: "settings",
  userSettings: "user_settings",
  refreshTokens: "refresh_tokens",
  passwordResetTokens: "password_reset_tokens",
  emailOtpChallenges: "email_otp_challenges",
  devices: "devices",
  deviceLocations: "device_locations",
  userKeys: "user_keys",
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
  /**
   * Alias for the same physical collection as `phishingChecks`.
   *
   * `services/firestoreMigration.ts` exposes both keys so call sites can use
   * whichever name reads better at the call site. Previously this key was absent
   * here, which made `getCollection("webChecks")` resolve to
   * `collection(undefined)` and throw at runtime -- reached via
   * `WebCheck.deleteMany()`, which routes through `deleteWhere`.
   */
  webChecks: "web_checks",
} as const;

export type CollectionKey = keyof typeof COLLECTIONS;

/** Sentinel document written by `db:bootstrap` to force collection creation. */
export const SCHEMA_MARKER_ID = "_schema";

/** Maps a collection key to the document type it stores. */
export interface CollectionDocMap {
  users: UserDoc;
  settings: SettingsDoc;
  userSettings: UserSettingDoc;
  refreshTokens: RefreshTokenDoc;
  passwordResetTokens: PasswordResetTokenDoc;
  emailOtpChallenges: EmailOtpChallengeDoc;
  devices: DeviceDoc;
  deviceLocations: DeviceLocationDoc;
  userKeys: UserKeyDoc;
  notifications: NotificationDoc;
  auditLogs: AuditLogDoc;
  securityEvents: SecurityEventDoc;
  threats: ThreatDoc;
  permissionScans: PermissionScanDoc;
  appPermissions: AppPermissionDoc;
  installedApps: InstalledAppDoc;
  appPermissionScans: AppPermissionScanDoc;
  companionAccounts: CompanionAccountDoc;
  companionSessions: CompanionSessionDoc;
  vpnSessions: VpnSessionDoc;
  wifiNetworks: WifiNetworkDoc;
  theftCommands: TheftCommandDoc;
  antiTheftCommands: AntiTheftCommandDoc;
  antiTheftLogs: AntiTheftLogDoc;
  phishingChecks: WebCheckDoc;
  /** Alias of `phishingChecks`; same physical collection. */
  webChecks: WebCheckDoc;
}

export type DocOf<K extends CollectionKey> = CollectionDocMap[K];

/** Re-exported for callers that need the raw Firestore timestamp type. */
export type { Timestamp };
