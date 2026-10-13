# Database Architecture

Shield uses Firebase Firestore through the Firebase Admin SDK. The server is the only trusted database client; the mobile app accesses data through the REST API.

## Collections

Each collection contains documents keyed by a Firestore document ID. All persisted records include `createdAt` and `updatedAt` unless they are immutable token records.

`users`, `devices`, `settings`, `refresh_tokens`, `password_reset_tokens`, `email_otp_challenges`, `vpn_sessions`, `web_checks`, `security_events`, `app_permission_scans`, `audit_logs`, `notifications`, `threats`, `device_locations`, `theft_commands`, `anti_theft_commands`, `anti_theft_logs`, `companion_accounts`, `companion_sessions`, `user_keys`, `user_settings`, `installed_apps`, `app_permissions`, and `permission_scans`.

The collection names are defined in `server/src/services/firestoreMigration.ts`.

## Document model

Firestore references are stored as string IDs (`userId`, `deviceId`, `companionId`, and related fields), not Mongo ObjectIds. Nested permission scan findings remain embedded in the parent `app_permission_scans` document.

The main document contracts are defined in `server/src/models/firestore.ts`. They preserve the existing API fields, including:

- User credentials, profile, role, protection score, and 2FA state.
- Devices, telemetry, location state, and remote-command state.
- Hashed refresh/reset/OTP tokens with expiry timestamps.
- VPN sessions, phishing checks, Wi-Fi observations, threats, notifications, and security events.
- Audit records with encrypted details and user/device ownership.
- Companion accounts/sessions, user keys, user settings, installed apps, and permission scans.

## Expiration

Firestore does not provide Mongo-style TTL indexes. Token and location documents retain their `expiresAt`/retention timestamps and should be removed by a scheduled Cloud Function, Cloud Scheduler job, or an administrative cleanup task.

## Access layer

`FirestoreModel` in `server/src/services/firestoreMigration.ts` provides the repository operations used by the existing services and controllers: filtered reads, single-document reads, sorting, pagination, creates, upserts, updates, bulk updates, deletes, and counts.
