# Error Reference — Shield API

All error responses follow this shape:

```json
{
  "success": false,
  "error": {
    "message": "Human-readable description",
    "code": "ERROR_CODE",
    "details": [...]
  }
}
```

`details` is only present on validation errors.

---

## HTTP status codes

| Status | Meaning | When |
|---|---|---|
| `200` | OK | Successful read or update |
| `201` | Created | Successful registration/creation |
| `400` | Bad Request | Validation failure, business logic error |
| `401` | Unauthorized | Missing/invalid/expired token, wrong credentials |
| `403` | Forbidden | Valid token but insufficient permissions |
| `404` | Not Found | Resource does not exist for this user |
| `409` | Conflict | Duplicate email, duplicate resource |
| `422` | Unprocessable | Semantic validation failure |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Unexpected server error |
| `503` | Service Unavailable | MongoDB disconnected |

---

## Common error messages

### Auth errors

| Message | Status | Cause |
|---|---|---|
| `Missing or malformed Authorization header` | 401 | No `Authorization: Bearer <token>` header |
| `Token has expired` | 401 | Access token TTL exceeded (15m) |
| `Invalid token` | 401 | Signature mismatch or malformed JWT |
| `Invalid email or password` | 401 | Wrong credentials (generic — no enumeration) |
| `MFA_REQUIRED` | 401 | 2FA is enabled but OTP was not provided |
| `Invalid authentication code` | 401 | Wrong TOTP OTP |
| `Invalid refresh token` | 401 | Refresh token not found |
| `Refresh token already used. All sessions revoked for security.` | 401 | Token replay detected |
| `Refresh token has expired` | 401 | 30-day refresh TTL exceeded |
| `An account with that email already exists` | 409 | Duplicate registration |
| `Invalid or expired reset token` | 400 | Token not found or expired |
| `Reset token has already been used` | 400 | One-time token reuse attempt |

---

### Validation errors (400)

Body:
```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": [
      { "field": "body.password", "message": "Password must be at least 8 characters" },
      { "field": "body.email", "message": "Invalid email address" }
    ]
  }
}
```

---

### Rate limiting (429)

```json
{
  "success": false,
  "error": { "message": "Too many authentication attempts, please try again later" }
}
```

Auth endpoints: 20 req/15min per IP. Destructive endpoints (lock/wipe): 5 req/hour per IP.

---

### MongoDB duplicate key (409)

```json
{
  "success": false,
  "error": { "message": "A record with that value already exists", "code": "DUPLICATE_KEY" }
}
```

---

## Mobile-side error handling

### `ShieldApiError` (`lib/apiClient.ts`)

```ts
class ShieldApiError extends Error {
  status: number;   // HTTP status code
  body: unknown;    // full parsed response body
}
```

The mobile app catches this in hook `onError` callbacks and in screen-level try/catch blocks. User-facing messages are derived from `error.message` — technical details are never surfaced to users.

### Silent 401 refresh

When `apiFetch` receives a 401:
1. `silentRefresh()` is called once (mutex prevents concurrent refreshes)
2. If the refresh succeeds → original request is retried transparently
3. If the refresh fails → tokens are cleared → `AuthGuard` redirects to `/login`

### DB health banner

`useDbHealth()` polls `GET /api/health` every 30s. If `databaseStatus !== "connected"` or the request fails, the Dashboard shows:
> "Database unavailable — showing cached data"

---

## Troubleshooting common issues

### "Invalid key provided to SecureStore"
**Root cause:** Old token storage keys contained `@` and `/` (e.g. `@shield/auth_token`), which are illegal in `expo-secure-store` on iOS/Android.

**Fix:** Already applied in `lib/secureStorage.ts`. Keys are now `shield_access_token` and `shield_refresh_token`.

**If you still see this:** Clear the app's storage (Simulator → Device → Erase All Content, or AVD cold boot) to remove stale invalid keys from the old version.

---

### "Scan data unavailable" + "Could not reach the scan service"
**Root causes (in order of likelihood):**
1. The SecureStore key crash (above) prevents the auth token from being read → every API call fails with a network error
2. `EXPO_PUBLIC_API_URL` is set to `localhost` on a physical device → resolves to the phone itself
3. The server is not running or MongoDB is disconnected
4. CORS is blocking the request (add your Expo Go origin to `CORS_ORIGINS`)

---

### "Authorization: Bearer undefined" being sent
This happens when `getToken()` returns `null` but the code still sets the header. The current `apiFetch` implementation skips the header when `token` is falsy:
```ts
if (token) {
  headers["Authorization"] = `Bearer ${token}`;
}
```
If you see this in server logs it means the mobile app is making an authenticated request before the token is loaded from SecureStore — check that `rehydrate()` completes before the API call fires.
