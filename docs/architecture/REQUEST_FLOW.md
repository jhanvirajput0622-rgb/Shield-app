# Shield App — Complete Request Flow Diagrams

Derived from the actual source code. Every box, arrow, and label maps to a
real file and function in this repository.

---

## 1. High-Level System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXPO GO  (physical device)                    │
│                                                                  │
│   React Native screens  →  TanStack Query / custom hooks        │
│   lib/apiClient.ts      →  fetch() + JWT + silent refresh       │
│   lib/secureStorage.ts  →  expo-secure-store (Keychain/Keystore)│
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │  HTTPS  (EXPO_PUBLIC_API_URL)
                             │  Content-Type: application/json
                             │  Authorization: Bearer <JWT>
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                  EXPRESS SERVER  :3001                           │
│                  server/src/server.ts                            │
│                                                                  │
│  helmet → cors → json() → compression → requestLogger           │
│  → generalLimiter → [route handler]                             │
│  → errorHandler  (last middleware)                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │  Firebase Admin SDK
                             │  (service account / emulator)
                             │
┌────────────────────────────▼────────────────────────────────────┐
│              GOOGLE CLOUD FIRESTORE                              │
│              project: shield-419e1                               │
│                                                                  │
│  users   devices   settings   refresh_tokens   web_checks  …    │
│  (26 collections — see docs/architecture/DATABASE.md)           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Authenticated Request — Step by Step

Example: `GET /api/shield/status`  (Dashboard screen loads)

```
MOBILE  app/(tabs)/index.tsx
│
│  useDashboard() hook
│  → apiFetch("/api/shield/status")
│
├─[1] READ TOKEN FROM SECURE STORAGE
│     lib/secureStorage.ts → SecureStore.getItemAsync("shield_access_token")
│     Key validated: /^[A-Za-z0-9._-]+$/  ← crash prevention
│
├─[2] BUILD HTTP REQUEST
│     headers["Authorization"] = "Bearer eyJhbGci..."
│     fetchWithTimeout(url, init)  ← 15 second AbortController
│
├─[3] NETWORK
│     fetch("http://192.168.1.42:3001/api/shield/status")
│     On fail → retry once (800ms delay) → throw ShieldApiError(status:0)
│
│─────────────────────────────── NETWORK BOUNDARY ───────────────────────────
│
SERVER  server.ts
│
├─[4] SECURITY HEADERS
│     helmet()  → X-Content-Type-Options, X-Frame-Options, HSTS, etc.
│
├─[5] CORS CHECK
│     cors()  → checks Origin against CORS_ORIGINS env var
│     Native mobile has no Origin header → allowed automatically
│
├─[6] BODY PARSING
│     express.json({ limit: "256kb" })
│     express.urlencoded({ extended: true, limit: "256kb" })
│
├─[7] GZIP COMPRESSION
│     compression()  → shrinks JSON response
│
├─[8] REQUEST LOGGING
│     requestLogger.middleware.ts → winston logger
│     Skips /healthz and /api/health
│
├─[9] RATE LIMITING
│     generalLimiter → 100 req / 15 min per IP
│     (auth endpoints use authLimiter → 20 req / 15 min)
│     (wipe/lock use destructiveLimiter → 5 req / 1 hour)
│     On exceed → 429 Too Many Requests
│
├─[10] ROUTE MATCHING
│      app.use("/api/shield", dashboardRoutes)
│      routes/dashboard.routes.ts
│      GET "/" → authenticate middleware → dashboardController
│
├─[11] JWT AUTHENTICATION
│      auth.middleware.ts → authenticate()
│      │
│      ├── header = req.headers.authorization
│      ├── must start with "Bearer "
│      ├── jwt.verify(token, JWT_SECRET)
│      │   ├── TokenExpiredError → 401 "Token has expired"
│      │   └── any other error  → 401 "Invalid token"
│      ├── payload.sub → req.userId  (Firestore document ID)
│      └── payload.email → req.userEmail
│
├─[12] OPTIONAL ZOD VALIDATION
│      validate.middleware.ts  (used on POST/PATCH routes)
│      Zod schema.parse({ body, query, params })
│      On fail → ZodError → errorHandler → 400 + field details
│
├─[13] CONTROLLER
│      dashboard.controller.ts → getProtectionStatus(req, res)
│      userId = req.userId  ← ALWAYS from JWT, never from body
│
├─[14] PARALLEL FIRESTORE QUERIES  (Promise.all — all 6 fire at once)
│
│      ┌─ securityEventService.getBlockedThreatsCount(userId)
│      │  SecurityEvent.countDocuments({ userId, isBlocked: true })
│      │  → Firestore AggregationQuery count()  ← bills per index entry
│      │
│      ├─ PhishingCheck.countDocuments({ userId })
│      │  → Firestore AggregationQuery count()
│      │
│      ├─ AppPermissionScan.findOne({ userId }).sort({ scannedAt: -1 })
│      │  → Firestore collection("app_permission_scans")
│      │     .where("userId", "==", userId)
│      │     .orderBy("scannedAt", "desc")
│      │     .orderBy(__name__, "asc")   ← total sort
│      │     .limit(1)
│      │
│      ├─ securityEventService.getRecentEvents(userId, 5)
│      │  → Firestore collection("security_events")
│      │     .where("userId", "==", userId)
│      │     .orderBy("occurredAt", "desc")
│      │     .limit(5)
│      │
│      ├─ Device.findOne({ userId }).sort({ lastSeenAt: -1 })
│      │  → Firestore collection("devices")
│      │     .where("userId", "==", userId)
│      │     .orderBy("lastSeenAt", "desc")
│      │     .limit(1)
│      │
│      └─ VpnSession.findOne({ userId, connectionStatus: "connected" })
│         → Firestore collection("vpn_sessions")
│            .where("userId", "==", userId)
│            .where("connectionStatus", "==", "connected")
│            .limit(1)
│
├─[15] SCORE CALCULATION (in-memory, no DB)
│      permissionsStatus = highRiskApps >= 3 ? "danger" : ...
│      networkStatus     = !activeVpn && activeDevice ? "warning" : "safe"
│      phishingStatus    = threatsBlocked >= 5 ? "danger" : ...
│      antitheftStatus   = device?.status === "lost" ? "danger" : ...
│      score             = sum of four 25-pt module scores
│      overall           = score >= 80 ? "protected" : ...
│
├─[16] SERIALIZE + RESPOND
│      res.json({ overall, score, recentEvents: [...], ... })
│      recentEvents: Firestore Timestamps → ISO strings
│
│─────────────────────────────── NETWORK BOUNDARY ───────────────────────────
│
MOBILE
│
├─[17] PARSE RESPONSE
│      apiFetch() → response.json() → returns typed DashboardStats
│
├─[18] TANSTACK QUERY CACHES RESULT
│      staleTime: 30_000 ms  (30 seconds)
│      retry: 2 on failure
│
└─[19] REACT RE-RENDERS
       Dashboard screen displays live data
       DB health banner polls /api/health every 30 seconds
```

---

## 3. Authentication Flow — Login

```
MOBILE  app/login.tsx
│
├─[1] FORM VALIDATION (client-side, fast feedback)
│     email format check, password not empty
│
├─[2] apiFetch("/api/auth/login", { skipAuth: true })
│     skipAuth: true → no Authorization header added
│
SERVER
│
├─[3] authLimiter → 20 req / 15 min (brute-force protection)
│
├─[4] validate(loginSchema)
│     Zod: email must be valid, password must be present
│     → 400 on fail
│
├─[5] auth.controller.ts → userService.login(email, password, otp?)
│
├─[6] USER LOOKUP
│     User.findOne({ email })
│     → Firestore: collection("users").where("email","==",email).limit(1)
│     If not found:
│       bcrypt.compare(password, "$2b$12$invalid...") ← constant-time
│       throw 401 "Invalid email or password"  ← no enumeration
│
├─[7] PASSWORD VERIFY
│     user.comparePassword(candidate)
│     → bcrypt.compare(candidate, user.passwordHash)  cost 12
│     If fail → 401 "Invalid email or password"
│
├─[8] 2FA CHECK (if user.twoFactorEnabled)
│     otp not provided → 401 "MFA_REQUIRED"
│     authenticator.verify({ token: otp, secret }) → 401 if wrong
│
├─[9] UPDATE LAST LOGIN
│     user.lastLoginAt = new Date()
│     user.save() → Firestore doc(userId).set({lastLoginAt}, {merge:true})
│
├─[10] ISSUE TOKENS
│      signAccessToken(userId, email)
│      → jwt.sign({ sub: userId, email }, JWT_SECRET, { expiresIn: "15m" })
│
│      issueRefreshToken(userId)
│      → generateRawToken() = crypto.randomBytes(32).toString("hex") [64 hex]
│      → hashRefreshToken(raw) = sha256(raw).hex
│      → RefreshToken.create({ userId, tokenHash, expiresAt, revoked:false })
│         Firestore: collection("refresh_tokens").doc(uuid).set({...})
│      → returns raw token (only hash is stored)
│
├─[11] RESPONSE
│      { success:true, data:{ accessToken, refreshToken, user:{...} } }
│
MOBILE
│
├─[12] STORE TOKENS SECURELY
│      storeToken(accessToken)
│      → SecureStore.setItemAsync("shield_access_token", jwt)
│         iOS: Keychain  |  Android: Keystore
│
│      storeRefreshToken(refreshToken)
│      → SecureStore.setItemAsync("shield_refresh_token", raw)
│
├─[13] SET AUTH STATE
│      authStore.setUser({ id, email, displayName })
│      → triggers AuthGuard re-render
│
└─[14] NAVIGATE
       router.replace("/(tabs)")  → Dashboard
```

---

## 4. Silent Token Refresh (15-minute access token expiry)

```
MOBILE  (any authenticated request after 15 min)
│
├─[1] apiFetch("/api/shield/status")
│     → 401 Unauthorized  "Token has expired"
│
├─[2] silentRefresh() called
│     Mutex lock: if already refreshing, wait on same promise
│     (prevents 3 concurrent 401s each triggering separate refreshes)
│
├─[3] getRefreshToken()
│     → SecureStore.getItemAsync("shield_refresh_token")
│     If null → clear tokens → AuthGuard redirects to /login
│
├─[4] POST /api/auth/refresh  { refreshToken: rawToken }
│
SERVER
│
├─[5] hashRefreshToken(rawToken) = sha256(raw).hex
│     RefreshToken.findOne({ tokenHash })
│     → Firestore: collection("refresh_tokens")
│          .where("tokenHash","==",hash).limit(1)
│
├─[6] SECURITY CHECKS
│     stored.revoked?
│     → YES: updateMany({ userId }, { $set:{revoked:true} }) ← ALL sessions
│            401 "Refresh token already used. All sessions revoked."
│            (detects token theft / replay attack)
│     stored.expiresAt < now?
│     → updateOne revoke + 401 "Refresh token has expired"
│
├─[7] ROTATE
│     updateOne({ _id:stored._id }, { $set:{revoked:true} })
│     Issue NEW access token + NEW refresh token
│
├─[8] RESPONSE
│     { data:{ accessToken:newJwt, refreshToken:newRaw } }
│
MOBILE
│
├─[9] storeToken(newAccess)
│     storeRefreshToken(newRefresh)
│
└─[10] RETRY original request with new token
       → proceeds normally
```

---

## 5. Error Response Paths

```
Any route handler throws
         │
         ▼
errorHandler.middleware.ts
         │
         ├── ZodError?
         │   └── 400  { success:false, error:{ message:"Validation failed",
         │                                     details:[{field,message}] } }
         │
         ├── ApiError (operational)?
         │   └── err.statusCode  { success:false, error:{ message } }
         │       401 Unauthorized
         │       403 Forbidden
         │       404 Not Found
         │       409 Conflict
         │       422 Unprocessable
         │       429 Too Many Requests
         │
         └── Unknown / programming error?
             └── 500  { success:false, error:{ message:"Internal server error" } }
                  + logger.error(stack)   ← never exposed to client
```

---

## 6. Firestore Query Layer Detail

Every model operation eventually reaches `db/queries.ts`:

```
Model.find({ userId }).sort({ createdAt:-1 }).limit(20)
         │
         ▼
FirestoreQuery.execute()
         │
         ├─ normalizeFilters({ userId: "abc" })
         │  → [{ field:"userId", op:"==", value:"abc" }]
         │
         ├─ applyFilters(collection, filters)
         │  → collection.where("userId", "==", "abc")
         │
         ├─ applyOrder(query, [{field:"createdAt", direction:"desc"}])
         │  → .orderBy("createdAt", "desc")
         │  → .orderBy(__name__, "asc")    ← total sort for stable cursors
         │
         ├─ query.limit(21)                ← fetches limit+1 to detect hasMore
         │
         ├─ Optional: query.startAfter(...cursorValues)  ← cursor pagination
         │
         └─ snapshot.get()
                  │
                  ▼
            Firestore Network Call
            (composite index required for multi-field queries)
                  │
                  ▼
            reviveDates(snapshot.data())
            Firestore Timestamps → JavaScript Date objects
                  │
                  ▼
            { items: DocOf<K>[], nextCursor: string|null, hasMore: boolean }
```

**countDocuments uses AggregationQuery — not a document scan:**

```
Model.countDocuments({ userId })
         │
         ▼
countDocs("collection", { userId })
         │
         ▼
collection.where("userId","==",userId).count().get()
         │
         ▼
snapshot.data().count   ← integer, bills 1 read per index entry
                           NOT 1 read per document
```

---

## 7. Server Startup Sequence

```
node dist/server.js
         │
    [1]  dotenv/config  → load server/.env
         │
    [2]  Build Express app (app.ts exports)
         helmet, cors, json, compression, requestLogger,
         generalLimiter, all route mounts, 404 handler, errorHandler
         │
    [3]  app.listen(3001, "0.0.0.0")
         ← Server accepts requests IMMEDIATELY
         ← /healthz and /api/health work even before Firestore connects
         ← Mobile app shows "Database unavailable" banner, not a crash
         │
    [4]  connectFirestore()  (non-blocking, void catch)
         │
         ├─ resolveServiceAccount()
         │  checks GOOGLE_APPLICATION_CREDENTIALS, serviceAccountKey.json, etc.
         │
         ├─ admin.initializeApp({ projectId, credential })
         │  OR (emulator) admin.initializeApp({ projectId: "demo-shield" })
         │
         ├─ getFirestore().collection("__health").limit(1).get()
         │  ← health probe, confirms Firestore is reachable
         │
         ├─ SUCCESS → firestoreStatus = "connected"
         │            GET /api/health → 200 { databaseStatus:"connected" }
         │
         └─ FAILURE → firestoreStatus = "error"
                      logger.warn(err.message)
                      GET /api/health → 503 { databaseStatus:"error" }
                      All Firestore queries fail → 500 errors on data routes
                      Mobile shows DB banner, falls back to cached data
```

---

## 8. Token Storage Map

```
                    MOBILE DEVICE STORAGE

┌─────────────────────────────────────────────────────────────┐
│  expo-secure-store  (iOS Keychain / Android Keystore)        │
│                                                             │
│  "shield_access_token"  →  eyJhbGciOiJIUzI1NiJ9...  (JWT)  │
│  "shield_refresh_token" →  a3f2b1c4...              (hex)  │
│  "shield.e2e_key"       →  base64(nacl 256-bit key)        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  AsyncStorage  (unencrypted — non-sensitive only)            │
│                                                             │
│  "shield_remember_me"   →  "true" / "false"                │
│  "@shield/onboarded"    →  "true"                          │
└─────────────────────────────────────────────────────────────┘

                    FIRESTORE  (server side)

┌─────────────────────────────────────────────────────────────┐
│  collection: refresh_tokens                                  │
│                                                             │
│  { _id, userId, tokenHash: sha256(raw), expiresAt,         │
│    revoked: false, createdAt, updatedAt }                   │
│                                                             │
│  Raw token NEVER stored. Only sha256 hash is persisted.     │
└─────────────────────────────────────────────────────────────┘
```
