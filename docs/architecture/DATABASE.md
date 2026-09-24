# Database Architecture — Shield App

MongoDB Atlas, database name: `shield`.

---

## Collection overview

| Collection | Model file | Description |
|---|---|---|
| `users` | `User.ts` | User accounts |
| `devices` | `Device.ts` | Registered mobile devices |
| `refresh_tokens` | `RefreshToken.ts` | Hashed refresh tokens |
| `password_reset_tokens` | `PasswordResetToken.ts` | One-time password reset tokens |
| `settings` | `Settings.ts` | Per-user boolean preference flags |
| `vpn_sessions` | `VpnSession.ts` | VPN connection history |
| `web_checks` | `PhishingCheck.ts` | URL phishing check results |
| `security_events` | `SecurityEvent.ts` | In-app security event log |
| `app_permission_scans` | `AppPermissionScan.ts` | Permission scan snapshots |
| `audit_logs` | `AuditLog.ts` | Immutable audit trail |
| `notifications` | `Notification.ts` | Push notification records |
| `threats` | `Threat.ts` | Threat intelligence |
| `anti_theft_logs` | `AntiTheftLog.ts` | Device location history |
| `anti_theft_commands` | `AntiTheftCommand.ts` | Remote commands (lock/wipe) |
| `companion_accounts` | `CompanionAccount.ts` | Companion accounts |
| `companion_sessions` | `CompanionSession.ts` | Companion login sessions |
| `user_keys` | `UserKey.ts` | User encryption key pairs |
| `user_settings` | `UserSetting.ts` | Extensible key-value settings |
| `installed_apps` | `InstalledApp.ts` | Individual app records from scans |
| `app_permissions` | `AppPermission.ts` | Per-app permission records |
| `permission_scans` | `PermissionScan.ts` | Permission scan metadata |

---

## Relationship map

```
users
 ├── devices (userId ref)
 │    ├── vpn_sessions (userId + deviceId refs)
 │    ├── web_checks (userId + deviceId refs)
 │    ├── security_events (userId + deviceId refs)
 │    ├── app_permission_scans (userId + deviceId refs)
 │    │    └── apps[] embedded subdocuments
 │    ├── anti_theft_logs (userId + deviceId refs)
 │    ├── anti_theft_commands (userId + deviceId refs)
 │    ├── notifications (userId + deviceId refs)
 │    └── audit_logs (userId + deviceId refs)
 │
 ├── refresh_tokens (userId ref)
 ├── password_reset_tokens (userId ref)
 ├── settings (userId ref — unique)
 ├── companion_accounts (userId ref — unique)
 │    └── companion_sessions (companionId ref)
 ├── user_keys (userId ref)
 └── user_settings (compound unique: userId + settingKey)
```

---

## Schema details

### `users`

```js
{
  _id: ObjectId,
  email: String,         // unique, lowercase, indexed
  passwordHash: String,  // select:false — never returned in queries
  displayName: String,
  name: String,
  phoneNumber: String,   // unique sparse (null = no constraint)
  role: "user" | "admin",
  protectionScore: Number (0-100),
  isActive: Boolean,
  twoFactorEnabled: Boolean,
  twoFactorSecret: String, // select:false
  lastLoginAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```
**Indexes:** `{ email: 1 }` unique, `{ phoneNumber: 1 }` unique sparse

---

### `devices`

```js
{
  _id: ObjectId,
  userId: ObjectId,      // ref: User
  deviceName: String,
  platform: String,      // "iOS" | "Android"
  osVersion: String,
  appVersion: String,
  deviceModel: String,
  deviceKeyFingerprint: String,  // SHA-256 of device public key
  publicKey: String,     // deprecated alias
  status: "online"|"offline"|"lost"|"locked"|"wiped",
  isOnline: Boolean,
  batteryPercent: Number,
  lastSeenAt: Date,
  vpnEnabled: Boolean,
  theftProtectionEnabled: Boolean,
  // Location
  locationAvailable: Boolean,
  latitude: Number,
  longitude: Number,
  locationLabel: String,
  locationAccuracy: Number,
  locationUpdatedAt: Date,
  // Remote command state
  pendingAction: "none"|"locate"|"lock"|"wipe",
  actionStatus: "idle"|"queued"|"delivered"|"completed"|"failed",
  lockMessage: String,
  // Telemetry
  simStatus: String,
  gpsPrecision: String,
  networkEncryption: String,
  createdAt: Date,
  updatedAt: Date
}
```
**Indexes:** `{ userId: 1, status: 1 }`

---

### `refresh_tokens`

```js
{
  _id: ObjectId,
  userId: ObjectId,
  deviceId: ObjectId,     // nullable
  tokenHash: String,      // SHA-256 of the raw token — unique
  expiresAt: Date,        // TTL index auto-deletes after expiry
  revoked: Boolean,
  issuedAt: Date,
  createdAt: Date
}
```
**Indexes:** `{ tokenHash: 1, revoked: 1, expiresAt: 1 }`, TTL on `expiresAt`

---

### `settings`

```js
{
  _id: ObjectId,
  userId: ObjectId,        // unique
  webProtectionEnabled: Boolean,
  vpnAutoConnect: Boolean,
  killSwitchEnabled: Boolean,
  notifyHighRiskApps: Boolean,
  notifyPhishingThreats: Boolean,
  notifyDeviceUnlock: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

---

### `vpn_sessions`

```js
{
  _id: ObjectId,
  userId: ObjectId,
  deviceId: ObjectId,      // nullable
  connectionStatus: "connecting"|"connected"|"disconnected"|"failed",
  localIp: String,         // e.g. "10.8.0.2"
  protocol: String,        // e.g. "WireGuard"
  serverLocation: String,  // e.g. "US East"
  encryption: String,      // e.g. "ChaCha20-Poly1305"
  bytesUploaded: Number,
  bytesDownloaded: Number,
  connectedAt: Date,
  disconnectedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```
**Indexes:** `{ userId: 1, connectionStatus: 1 }`

---

### `web_checks` (model: `PhishingCheck`)

```js
{
  _id: ObjectId,
  userId: ObjectId,
  deviceId: ObjectId,
  urlHash: String,         // SHA-512 prefix — privacy-preserving
  encryptedUrl: String,    // nacl.secretbox ciphertext — server cannot decrypt
  domain: String,          // hostname only e.g. "paypal.com"
  verdict: "safe"|"malicious"|"unknown"|"suspicious",
  threatType: String,
  source: "manual_check"|"auto_scan"|"sms"|"qr",
  checkedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```
**Indexes:** `{ userId: 1, checkedAt: -1 }`, `{ urlHash: 1 }`

---

### `app_permission_scans`

Apps are **embedded** (not referenced) because they are always read with their scan.

```js
{
  _id: ObjectId,
  userId: ObjectId,
  deviceId: ObjectId,
  apps: [{              // embedded subdocuments
    appName: String,
    packageName: String,
    category: String,
    requestedPermissions: [String],
    riskScore: Number (0-100),
    riskLevel: "safe"|"low"|"medium"|"high"|"critical",
    riskReasons: [String]
  }],
  totalApps: Number,
  highRiskCount: Number,
  scannedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```
**Indexes:** `{ userId: 1, scannedAt: -1 }`

---

### `security_events`

```js
{
  _id: ObjectId,
  userId: ObjectId,
  deviceId: ObjectId,     // nullable
  eventType: String,      // e.g. "vpn_connected", "phishing_detected"
  severity: "info"|"low"|"medium"|"high"|"critical",
  title: String,
  description: String,
  metadata: Mixed,        // freeform JSON
  isBlocked: Boolean,
  occurredAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```
**Indexes:** `{ userId: 1, occurredAt: -1 }`, `{ userId: 1, severity: 1 }`

---

### `audit_logs`

Append-only. The `detailsEncrypted` field is AES-256-GCM encrypted and never returned through the API.

```js
{
  _id: ObjectId,
  userId: ObjectId,
  deviceId: ObjectId,     // nullable
  action: String,         // LOGIN | LOGOUT | VPN_CONNECT | ...
  summary: String,        // human-readable, safe to display
  detailsEncrypted: String, // select:false — AES-256-GCM blob
  ipAddress: String,
  userAgent: String,
  createdAt: Date,
  updatedAt: Date
}
```
**Indexes:** `{ userId: 1, createdAt: -1 }`, `{ deviceId: 1, createdAt: -1 }`

**Audit actions:**
`LOGIN` `LOGOUT` `REGISTER` `PASSWORD_RESET` `VPN_CONNECT` `VPN_DISCONNECT`
`URL_CHECK` `THREAT_DETECTED` `LOCK_DEVICE` `WIPE_DEVICE` `LOCATE_DEVICE`
`PERMISSION_SCAN` `SETTINGS_UPDATED` `DEVICE_REGISTERED` `DEVICE_DELETED`
`TOKEN_REFRESH` `COMPANION_LOGIN` `COMPANION_LOGOUT`

---

### `threats`

```js
{
  _id: ObjectId,
  threatType: "Phishing"|"Malware"|"Suspicious URL"|"Spyware"|...,
  threatName: String,
  description: String,
  severity: "Low"|"Medium"|"High"|"Critical",
  source: String,
  indicators: [String],   // domains, IPs, hashes
  firstSeenAt: Date,
  lastSeenAt: Date,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```
**Indexes:** `{ threatType: 1, severity: 1, isActive: 1 }`

---

### `password_reset_tokens`

```js
{
  _id: ObjectId,
  userId: ObjectId,
  tokenHash: String,    // SHA-256 of the raw token — unique
  expiresAt: Date,      // TTL index + 1h grace period auto-deletes
  used: Boolean,
  createdAt: Date
}
```
**Indexes:** `{ tokenHash: 1, used: 1, expiresAt: 1 }`, TTL on `expiresAt`

---

## Indexing strategy

All collections that are queried by `userId` have a `{ userId: 1 }` index (or compound). Time-series collections use `{ userId: 1, <timestamp>: -1 }` for efficient recent-N queries.

TTL indexes on `refresh_tokens.expiresAt` and `password_reset_tokens.expiresAt` keep those collections tidy automatically — no cron job needed.

The `settings` collection has `{ userId: 1 }` unique, enforcing one settings document per user. `user_settings` has `{ userId: 1, settingKey: 1 }` unique compound for the key-value store.
