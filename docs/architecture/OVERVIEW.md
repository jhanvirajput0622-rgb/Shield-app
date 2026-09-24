# Architecture Overview — Shield App

---

## System architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     SHIELD MOBILE APP                        │
│              React Native / Expo (TypeScript)                │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │Dashboard │  │Protection│  │   Apps   │  │ Settings  │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────────┘  │
│  ┌─────────┐  ┌──────────┐  ┌───────────────────────────┐  │
│  │ Network │  │ Phishing │  │       Anti-Theft           │  │
│  └─────────┘  └──────────┘  └───────────────────────────┘  │
│                                                             │
│  State: TanStack Query (server) + authStore (auth) + Context│
│  API client: lib/apiClient.ts (fetch + JWT + silent refresh)│
│  Storage: expo-secure-store (tokens) + AsyncStorage (prefs) │
│  Encryption: tweetnacl (E2E, URL hashing)                   │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS (REST JSON)
                           │ Authorization: Bearer <JWT>
┌──────────────────────────▼──────────────────────────────────┐
│                    SHIELD API SERVER                         │
│              Node.js 18+ / Express 4 / TypeScript           │
│                                                             │
│  Security:  helmet | cors | express-rate-limit              │
│  Auth:      JWT (HS256, 15m) + refresh token rotation       │
│  Validation: Zod schemas on every request body              │
│  Logging:   winston (structured JSON)                       │
│  Audit:     AES-256-GCM encrypted audit log details         │
│                                                             │
│  Routes:                                                    │
│   /api/auth          Authentication lifecycle               │
│   /api/users         User profile + account deletion        │
│   /api/devices       Device registration + management       │
│   /api/shield/status Dashboard stats                        │
│   /api/shield/network VPN connect/disconnect                │
│   /api/shield/phishing URL checking + log                   │
│   /api/shield/device  Anti-theft: locate/lock/wipe          │
│   /api/shield/permissions App permission scans              │
│   /api/shield/settings  User preferences                    │
│   /api/notifications   Push notification records            │
│   /api/threats         Threat intelligence                  │
│   /api/audit-logs      Security audit trail                 │
│   /api/companion-*     Companion account system             │
│   /api/vpn-sessions    VPN session history                  │
│   /api/web-checks      Web check history                    │
│   /api/user-settings   Key-value settings store             │
│   /api/health          MongoDB health probe                 │
└──────────────────────────┬──────────────────────────────────┘
                           │ Mongoose ODM
┌──────────────────────────▼──────────────────────────────────┐
│                    MONGODB ATLAS                             │
│                   database: "shield"                        │
│                                                             │
│  users                devices             refresh_tokens    │
│  settings             vpn_sessions        password_reset_*  │
│  app_permission_scans web_checks          security_events   │
│  audit_logs           notifications       threats           │
│  anti_theft_logs      anti_theft_commands companion_*       │
│  installed_apps       app_permissions     user_keys         │
│  user_settings                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Data flow — full request lifecycle

```
1. User taps "Run Full Scan" on the Apps screen

2. app.tsx → handleScan()
     ↓
3. useRunPermissionScan().mutateAsync()
     ↓
4. @workspace/api-client-react → customFetch()
     ↓
5. lib/apiClient.ts → apiFetch("/api/shield/permissions/scan", POST)
     ↓
6. getToken() → SecureStore.getItemAsync("shield_access_token")
   headers["Authorization"] = "Bearer <token>"
     ↓
7. fetch(EXPO_PUBLIC_API_URL + "/api/shield/permissions/scan")
     ↓
8. Express → authenticate() middleware
   jwt.verify(token, JWT_SECRET) → req.userId = ObjectId
     ↓
9. permissionsController.runScan()
     ↓
10. permissionScanService.runScan(userId, rawApps)
      ↓
11. Risk engine scores each app:
    - known dangerous permission combinations
    - category heuristics
    - Mongoose AppPermissionScan.create()
      ↓
12. res.json({ apps, totalApps, highRiskCount, lastScannedAt })
      ↓
13. React Query caches response, invalidates related queries
      ↓
14. app.tsx UI re-renders with live scan results
```

---

## Monorepo structure

```
Shield-app/
├── pnpm-workspace.yaml        Workspace config
├── package.json               Root — workspace scripts, shared deps
├── tsconfig.base.json         Base TS config (moduleResolution: bundler)
├── tsconfig.json              Workspace TS project references
│
├── artifacts/
│   └── mobile/                Expo React Native app
│
├── server/                    Express + Mongoose backend
│
├── lib/
│   ├── api-clients-react/     Orval-generated TanStack Query hooks
│   ├── api-spec/              openapi.yaml + orval.config.ts
│   ├── api-zod/               Generated Zod validators
│   └── db/                    Shared DB schema (future use)
│
├── scripts/                   Workspace-level scripts
└── docs/                      This documentation
```

---

## Security model

### Defense-in-depth layers

| Layer | Mechanism |
|---|---|
| Transport | HTTPS only (Expo enforces HTTPS on native) |
| Headers | `helmet` — HSTS, X-Frame-Options, CSP (disabled for mobile), etc. |
| CORS | Allowlist from `CORS_ORIGINS` env var; native mobile has no `Origin` header (allowed by policy) |
| Rate limiting | General: 100 req/15min. Auth: 20 req/15min. Destructive: 5 req/hour |
| Authentication | JWT HS256, 15m access + 30d refresh with rotation |
| Token storage | iOS Keychain / Android Keystore via `expo-secure-store` |
| Password storage | bcrypt cost 12 — never stored as plaintext |
| Refresh token storage | SHA-256 hash in MongoDB — raw token never persisted server-side |
| Replay attack detection | Revoked token reuse → all sessions for that user are invalidated |
| Input validation | Zod schemas on all request bodies; Mongoose schema validation |
| Authorization | `req.userId` always from JWT, never from request body |
| Data isolation | Every query includes `{ userId: req.userId }` — users cannot access others' data |
| Audit logging | AES-256-GCM encrypted details stored for security events |
| Sensitive field protection | `passwordHash`: `select: false`. `twoFactorSecret`: `select: false`. `privateKeyEncrypted`: `select: false` |
| E2E encryption | URLs are hashed + encrypted client-side before leaving the device |
| Secrets management | All secrets in `.env` (never committed). `.env.example` has placeholders |

### What the server never logs

- Passwords or password hashes
- Access tokens or refresh tokens
- Private keys
- Raw MongoDB URIs (only error messages, not the full connection string)
- Full URL content (only domain + hash)

---

## Key architectural decisions

**1. No direct MongoDB from mobile.** The mobile app uses only the REST API. MongoDB credentials never appear in the JS bundle.

**2. Dual API client layers.** The generated `@workspace/api-client-react` hooks (from Orval + OpenAPI spec) are used where the spec covers the endpoint. Custom hooks using `apiFetch` directly are used for endpoints not in the spec (dashboard, anti-theft, phishing). This provides type safety on generated paths while keeping flexibility on custom ones.

**3. Module-level auth singleton vs Context.** `authStore.ts` uses a module-level pattern rather than React Context. This allows `rehydrate()` to be called once in `AppContext` and the state to be accessed by any hook without prop drilling or Provider wrapping.

**4. SecureStore key naming.** All keys use `[A-Za-z0-9._-]` only — enforced by `lib/secureStorage.ts`. The old `@shield/auth_token` keys were invalid on iOS/Android and caused crashes.

**5. E2E encryption.** The server stores an encrypted blob for phishing URLs but cannot decrypt it. Privacy is preserved even if the database is compromised.

**6. AppPermissionScan embedding.** Apps are embedded inside the scan document rather than in a separate collection. This matches the read access pattern (always fetched together) and avoids joins.
