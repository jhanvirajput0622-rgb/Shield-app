# API Reference — Shield

Base URL: configured in `EXPO_PUBLIC_API_URL` (e.g. `http://192.168.1.42:3001`)

**Authentication:** All endpoints except auth and health require `Authorization: Bearer <accessToken>`.

**Response envelope:**
- Success: `{ "success": true, "data": { ... } }` (auth endpoints) or flat object (shield module endpoints)
- Error: `{ "success": false, "error": { "message": "...", "code": "..." } }`

---

## Health

### `GET /healthz`
Liveness probe. No auth required.

**Response 200:**
```json
{ "status": "ok", "timestamp": "2026-08-11T12:00:00.000Z" }
```

---

### `GET /api/health`
Full health check including MongoDB status.

**Response 200 (connected):**
```json
{
  "success": true,
  "service": "Shield API",
  "database": "MongoDB",
  "databaseStatus": "connected",
  "timestamp": "2026-08-11T12:00:00.000Z",
  "version": "1.0.0"
}
```

**Response 503 (disconnected):**
```json
{
  "success": false,
  "databaseStatus": "disconnected",
  "databaseError": "connection timeout"
}
```

---

## Authentication (`/api/auth`)

### `POST /api/auth/register`
Rate limited: 20 req/15min.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "Secur3P@ss!",
  "name": "Alex Johnson",
  "displayName": "Alex",
  "phoneNumber": "+911234567890",
  "confirmPassword": "Secur3P@ss!"
}
```

Password rules: min 8 chars, uppercase, lowercase, digit, special character.

**Response 201:**
```json
{
  "success": true,
  "data": {
    "accessToken": "<jwt>",
    "token": "<jwt>",
    "refreshToken": "<opaque-hex>",
    "user": {
      "id": "64a...",
      "email": "user@example.com",
      "displayName": "Alex Johnson",
      "twoFactorEnabled": false
    }
  }
}
```

**Errors:** `409` email already exists, `400` validation failure.

---

### `POST /api/auth/login`
Rate limited: 20 req/15min.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "Secur3P@ss!",
  "otp": "123456"
}
```
`otp` is required only when `twoFactorEnabled = true`.

**Response 200:** Same shape as register.

**Response 401 (2FA required):**
```json
{ "success": false, "error": { "message": "MFA_REQUIRED" } }
```

**Errors:** `401` invalid credentials, `400` validation.

---

### `POST /api/auth/refresh`
Rate limited: 20 req/15min.

**Body:**
```json
{ "refreshToken": "<opaque-hex>" }
```

**Response 200:** Same shape as login. Old refresh token is revoked; new one is issued.

**Errors:** `401` invalid/revoked/expired token.

---

### `POST /api/auth/logout`

**Body:**
```json
{ "refreshToken": "<opaque-hex>" }
```

`refreshToken` is optional. If provided, the specific token is revoked on the server.

**Response 200:**
```json
{ "success": true, "message": "Logged out" }
```

---

### `POST /api/auth/logout-all` 🔒
Requires valid access token. Revokes **all** refresh tokens for the authenticated user.

**Response 200:**
```json
{ "success": true, "message": "All sessions revoked" }
```

---

### `GET /api/auth/me` 🔒

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "64a...",
    "email": "user@example.com",
    "displayName": "Alex Johnson",
    "name": "Alex Johnson",
    "phoneNumber": "+911234567890",
    "twoFactorEnabled": false,
    "protectionScore": 85,
    "isActive": true,
    "lastLoginAt": "2026-08-11T10:00:00.000Z",
    "linkedDeviceCount": 1
  }
}
```

---

### `POST /api/auth/forgot-password`
Rate limited: 20 req/15min.

**Body:**
```json
{ "email": "user@example.com" }
```

Always returns 200 regardless of whether the email exists (prevents enumeration).

In development: the token is **logged to the server console**.

**Response 200:**
```json
{ "success": true, "message": "If an account exists, a reset link was sent." }
```

---

### `POST /api/auth/reset-password`
Rate limited: 20 req/15min.

**Body:**
```json
{
  "token": "<hex-from-server-log>",
  "password": "NewSecur3P@ss!",
  "confirmPassword": "NewSecur3P@ss!"
}
```

Token expires in 1 hour. After use, all existing sessions are revoked.

**Response 200:**
```json
{ "success": true, "message": "Password has been successfully reset" }
```

**Errors:** `400` invalid/expired/already-used token.

---

### `POST /api/auth/2fa/setup` 🔒
Generates a TOTP secret and returns a QR code data URI.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "secret": "BASE32SECRET",
    "qrCode": "data:image/png;base64,..."
  }
}
```

---

### `POST /api/auth/2fa/verify` 🔒
Verifies the OTP and enables 2FA.

**Body:** `{ "otp": "123456" }`

**Response 200:** `{ "success": true, "message": "Two-factor authentication enabled" }`

---

### `POST /api/auth/2fa/disable` 🔒
Disables 2FA (requires account password).

**Body:** `{ "password": "Secur3P@ss!" }`

**Response 200:** `{ "success": true, "message": "Two-factor authentication disabled" }`

---

## Users (`/api/users`)

### `GET /api/users/me` 🔒
Returns the authenticated user's profile.

### `DELETE /api/users/me` 🔒
Permanently deletes the user account and all associated data (devices, settings, VPN sessions, scan results, audit logs, notifications).

**Response 200:** `{ "success": true, "message": "Account deleted" }`

---

## Dashboard (`/api/shield`)

### `GET /api/shield/status` 🔒
Main dashboard statistics.

**Response 200:**
```json
{
  "overall": "protected",
  "score": 92,
  "permissionsStatus": "safe",
  "networkStatus": "warning",
  "phishingStatus": "safe",
  "antitheftStatus": "safe",
  "lastScanAt": "2026-08-11T09:00:00.000Z",
  "threatsBlocked": 2,
  "appsScanned": 34,
  "linksScanned": 47,
  "recentEvents": [
    {
      "_id": "64a...",
      "eventType": "vpn_connected",
      "severity": "info",
      "title": "VPN Connected",
      "description": "Secure tunnel established via WireGuard",
      "isBlocked": false,
      "occurredAt": "2026-08-11T11:00:00.000Z"
    }
  ]
}
```

`overall`: `"protected"` (score ≥ 80) | `"action_needed"` (score ≥ 50) | `"at_risk"` (score < 50)

---

## Network / VPN (`/api/shield/network`)

### `GET /api/shield/network` 🔒
Current network and VPN status.

**Response 200:**
```json
{
  "ssid": "Unknown",
  "isSecured": true,
  "vpnConnected": true,
  "riskLevel": "safe",
  "vpnSession": {
    "connected": true,
    "localIp": "10.8.0.2",
    "protocol": "WireGuard",
    "serverLocation": "US East",
    "encryption": "ChaCha20-Poly1305",
    "connectedAt": "2026-08-11T11:00:00.000Z"
  }
}
```

### `POST /api/shield/network/vpn/connect` 🔒
Establishes a VPN session.

**Response 200:**
```json
{
  "connected": true,
  "localIp": "10.8.0.2",
  "protocol": "WireGuard",
  "serverLocation": "US East",
  "encryption": "ChaCha20-Poly1305",
  "connectedAt": "2026-08-11T11:00:00.000Z"
}
```

### `POST /api/shield/network/vpn/disconnect` 🔒
Disconnects all active VPN sessions.

**Response 200:** `{ "success": true }`

---

## App Permissions (`/api/shield/permissions`)

### `GET /api/shield/permissions` 🔒
Latest permission scan results.

**Response 200:**
```json
{
  "apps": [
    {
      "id": "com.example.app",
      "name": "QuickCalc Pro",
      "packageName": "com.example.app",
      "category": "utility",
      "requestedPermissions": ["SMS", "CONTACTS", "LOCATION"],
      "riskScore": 88,
      "riskLevel": "critical",
      "riskReasons": ["Calculator app requesting SMS access — highly unusual"],
      "lastScannedAt": "2026-08-11T09:00:00.000Z"
    }
  ],
  "totalApps": 34,
  "highRiskCount": 2,
  "lastScannedAt": "2026-08-11T09:00:00.000Z"
}
```

Returns `{ apps: [], totalApps: 0, highRiskCount: 0 }` if no scan exists yet.

### `POST /api/shield/permissions/scan` 🔒
Runs a new permission scan.

**Body (optional):**
```json
{
  "apps": [
    {
      "appName": "QuickCalc Pro",
      "packageName": "com.example.app",
      "category": "utility",
      "requestedPermissions": ["SMS", "CONTACTS"]
    }
  ]
}
```

Body may be empty — server will use default demo data if no apps are provided.

**Response 200:** Same shape as `GET /api/shield/permissions`.

---

## Phishing / Web Protection (`/api/shield/phishing`)

### `GET /api/shield/phishing/log` 🔒

**Response 200:**
```json
{
  "entries": [
    {
      "id": "64a...",
      "domain": "paypa1-secure.com",
      "verdict": "malicious",
      "threatType": "PHISHING",
      "source": "manual_check",
      "checkedAt": "2026-08-11T10:00:00.000Z"
    }
  ],
  "totalScanned": 47,
  "threatsBlocked": 2
}
```

### `POST /api/shield/phishing/check` 🔒

**Body:**
```json
{
  "urlHash": "a3f2b1c4d5e6f708",
  "domain": "paypa1-secure.com",
  "encryptedUrl": "<base64-nacl-ciphertext>",
  "source": "manual_check"
}
```

`encryptedUrl` is optional. It is stored as ciphertext — the server cannot decrypt it.

**Response 200:**
```json
{
  "verdict": "malicious",
  "threatType": "PHISHING",
  "message": "Malicious Link Blocked",
  "logEntry": {
    "id": "64a...",
    "domain": "paypa1-secure.com",
    "verdict": "malicious",
    "source": "manual_check",
    "checkedAt": "2026-08-11T10:00:00.000Z"
  }
}
```

`verdict`: `"safe"` | `"malicious"` | `"suspicious"` | `"unknown"`

### `DELETE /api/shield/phishing/log` 🔒
Clears all phishing log entries for the authenticated user.

**Response 200:** `{ "success": true }`

---

## Anti-Theft (`/api/shield/device`)

### `GET /api/shield/device` 🔒
Primary device status.

**Response 200:**
```json
{
  "deviceName": "Alex's iPhone",
  "status": "online",
  "batteryPercent": 73,
  "lastSeenAt": "2026-08-11T11:55:00.000Z",
  "locationAvailable": true,
  "latitude": 37.7749,
  "longitude": -122.4194,
  "locationLabel": "",
  "simStatus": "Active",
  "gpsPrecision": "±8m",
  "networkEncryption": "WPA3",
  "pendingAction": "none",
  "actionStatus": "idle"
}
```

Returns a default offline shell if no device is registered yet.

### `POST /api/shield/device/register` 🔒

**Body:**
```json
{
  "deviceName": "Alex's iPhone",
  "platform": "iOS",
  "osVersion": "17.0",
  "appVersion": "1.0.0",
  "model": "iPhone 15 Pro",
  "publicKey": "<base64-public-key>"
}
```

### `POST /api/shield/device/locate` 🔒
Updates device GPS location.

**Body:**
```json
{
  "latitude": 37.7749,
  "longitude": -122.4194,
  "accuracy": 8.5
}
```

**Response 200:** Updated device status.

### `POST /api/shield/device/lock` 🔒
Rate limited: 5 req/hour (destructive limiter).

**Body:**
```json
{ "message": "This device belongs to Alex. Call +1-555-0100 to return." }
```

**Response 200:**
```json
{ "success": true, "status": "queued", "message": "Lock command sent" }
```

### `POST /api/shield/device/wipe` 🔒
Rate limited: 5 req/hour.

**Body:**
```json
{ "confirmationPhrase": "Alex's iPhone" }
```

The `confirmationPhrase` must exactly match the registered device name.

**Response 200:**
```json
{ "success": true, "status": "queued", "message": "Wipe command sent" }
```

---

## Settings (`/api/shield/settings`)

### `GET /api/shield/settings` 🔒

**Response 200:**
```json
{
  "webProtectionEnabled": true,
  "vpnAutoConnect": false,
  "killSwitchEnabled": false,
  "notifyHighRiskApps": true,
  "notifyPhishingThreats": true,
  "notifyDeviceUnlock": false,
  "twoFactorEnabled": false,
  "lastLoginAt": "2026-08-11T10:00:00.000Z",
  "accountEmail": "user@example.com",
  "linkedDeviceCount": 1
}
```

### `PATCH /api/shield/settings` 🔒
Partial update — only send the fields you want to change.

**Body (any subset):**
```json
{
  "vpnAutoConnect": true,
  "killSwitchEnabled": true,
  "notifyHighRiskApps": false
}
```

**Response 200:** Full settings object (same shape as GET).

---

## Devices (`/api/devices`)

### `GET /api/devices` 🔒
Returns all devices registered to the authenticated user.

### `POST /api/devices` 🔒
Register a new device.

### `GET /api/devices/:id` 🔒
Get a specific device by ID (must belong to authenticated user).

### `DELETE /api/devices/:id` 🔒
Deregister a device.

---

## Notifications (`/api/notifications`)

### `GET /api/notifications` 🔒
Query params: `?page=1&limit=20&unread=true`

**Response 200:**
```json
{
  "success": true,
  "data": [...],
  "meta": { "total": 5, "unreadCount": 2, "page": 1, "limit": 20 }
}
```

### `PATCH /api/notifications/mark-read` 🔒
**Body:** `{ "ids": ["64a...", "64b..."] }`

### `PATCH /api/notifications/mark-all-read` 🔒

### `DELETE /api/notifications/:id` 🔒

---

## Threats (`/api/threats`)

### `GET /api/threats` 🔒
Query params: `?severity=High&threatType=Phishing&page=1&limit=20`

**Response 200:** Paginated threat list with `meta: { total, page, limit, pages }`.

### `GET /api/threats/:id` 🔒

---

## Audit Logs (`/api/audit-logs`)

### `GET /api/audit-logs` 🔒
Query params: `?limit=50`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "64a...",
      "action": "VPN_CONNECT",
      "summary": "VPN connected via WireGuard",
      "deviceId": "64b...",
      "ipAddress": "192.168.1.42",
      "createdAt": "2026-08-11T11:00:00.000Z"
    }
  ]
}
```

`detailsEncrypted` is never included in the API response.

---

## Companion Accounts (`/api/companion-accounts`)

### `GET /api/companion-accounts` 🔒
### `POST /api/companion-accounts` 🔒 — `{ email, password }`
### `POST /api/companion-accounts/login` 🔒 — `{ email, password }`
### `GET /api/companion-accounts/sessions` 🔒
### `DELETE /api/companion-accounts` 🔒

---

## User Settings (`/api/user-settings`)
Key-value store for extensible settings.

### `GET /api/user-settings` 🔒
Returns all settings as `{ key: parsedValue }`.

### `PUT /api/user-settings/:key` 🔒
**Body:** `{ "settingKey": "dark_mode", "settingValue": "true" }`

### `POST /api/user-settings/batch` 🔒
**Body:** `{ "settings": [{ "settingKey": "...", "settingValue": "..." }] }`

### `DELETE /api/user-settings/:key` 🔒

---

## VPN Sessions (`/api/vpn-sessions`)
### `GET /api/vpn-sessions` 🔒 — Query: `?page=1&limit=20`
### `GET /api/vpn-sessions/:id` 🔒

---

## Web Checks (`/api/web-checks`)
### `GET /api/web-checks` 🔒 — Query: `?page=1&limit=20`
### `GET /api/web-checks/:id` 🔒

---

## App Permissions (`/api/app-permissions`)
### `GET /api/app-permissions` 🔒 — Query: `?appId=<id>`
### `GET /api/app-permissions/:id` 🔒

---

## Installed Apps (`/api/installed-apps`)
### `GET /api/installed-apps` 🔒 — Query: `?scanId=<id>`
### `GET /api/installed-apps/:id` 🔒

---

## User Keys (`/api/user-keys`)
### `GET /api/user-keys` 🔒 — Returns public keys only (never privateKeyEncrypted)
### `POST /api/user-keys` 🔒 — `{ publicKey, privateKeyEncrypted }`
### `DELETE /api/user-keys/:id` 🔒
