# Authentication Guide — Shield App

Complete reference for the authentication system: architecture, flows, token lifecycle, and security design.

---

## Overview

Shield uses a **JWT access token + rotating refresh token** strategy.

```
Mobile App
   │
   ├─ POST /api/auth/register ──► bcrypt(password, 12) → User in MongoDB
   ├─ POST /api/auth/login ──────► verify hash → issue access + refresh token
   ├─ POST /api/auth/google ─────► verify Google ID token → sign in / auto-register
   ├─ GET  /api/auth/me ─────────► validate JWT → return user profile
   ├─ POST /api/auth/refresh ────► rotate refresh token → new access token
   ├─ POST /api/auth/logout ─────► revoke refresh token
   ├─ POST /api/auth/forgot-password → generate reset token (logged, not emailed in dev)
   ├─ POST /api/auth/reset-password  → validate token → update password
   ├─ POST /api/auth/2fa/setup ──► generate TOTP secret + QR code
   ├─ POST /api/auth/2fa/verify ─► verify OTP → enable 2FA
   └─ POST /api/auth/2fa/disable ► verify password → disable 2FA
```

---

## Token architecture

### Access token
- **Format:** JWT (HS256), signed with `JWT_SECRET`
- **TTL:** `JWT_EXPIRES_IN` (default `15m`)
- **Payload:** `{ sub: userId, email, iat, exp }`
- **Storage on device:** `expo-secure-store` key `shield_access_token` (iOS Keychain / Android Keystore)
- **Attached to requests:** `Authorization: Bearer <token>`

### Refresh token
- **Format:** 32-byte random hex (opaque)
- **TTL:** `JWT_REFRESH_EXPIRES_IN` (default `30d`)
- **Storage on device:** `expo-secure-store` key `shield_refresh_token`
- **Storage on server:** SHA-256 hash stored in `refresh_tokens` collection — the raw token is never persisted server-side
- **MongoDB TTL index:** expired tokens auto-deleted by MongoDB after expiry

### Token rotation (security)
Every `POST /api/auth/refresh` call:
1. Looks up the hash of the incoming refresh token
2. Verifies it is not revoked or expired
3. **Revokes** the used token (one-time use)
4. Issues a **new** access token + **new** refresh token

If a refresh token that has already been revoked is presented, **all** sessions for that user are immediately invalidated — this detects token theft or replay attacks.

---

## SecureStore key names

All keys follow the regex `^[A-Za-z0-9._-]+$` — required by `expo-secure-store` on iOS/Android.

| Purpose | Key | Storage |
|---|---|---|
| Access token | `shield_access_token` | expo-secure-store (native) / AsyncStorage (web) |
| Refresh token | `shield_refresh_token` | expo-secure-store (native) / AsyncStorage (web) |
| E2E device key | `shield.e2e_key` | expo-secure-store (native) / AsyncStorage (web) |
| Remember me flag | `shield_remember_me` | AsyncStorage (non-sensitive) |

> **Historical note:** The old keys `@shield/auth_token` and `@shield/refresh_token` contained `@` and `/` characters that are illegal in SecureStore. This caused the "Invalid key provided to SecureStore" crash visible on the Scan screen. The fix is in `artifacts/mobile/lib/secureStorage.ts`.

---

## Silent token refresh

`lib/apiClient.ts` intercepts 401 responses and attempts a silent refresh before surfacing an error to the UI:

```
API call → 401 response
    │
    ▼
Read refresh token from SecureStore
    │
    ├─ token missing → clear state → AuthGuard redirects to /login
    │
    ▼
POST /api/auth/refresh
    │
    ├─ success → store new access token → retry original request
    │
    └─ failure → clear both tokens → AuthGuard redirects to /login
```

A mutex (`_refreshPromise`) prevents multiple concurrent 401 responses from each triggering their own refresh — they all wait on the same promise.

---

## Auth guard (mobile)

`app/_layout.tsx` wraps the entire navigation stack with `AuthGuard`:

```tsx
const PUBLIC_SEGMENTS = ["login", "signup", "forgot-password", "onboarding"];

function AuthGuard({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return; // wait for rehydration
    const segment = pathname?.split('/')[1] ?? "";
    if (!isAuthenticated && !PUBLIC_SEGMENTS.includes(segment)) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, pathname]);
  ...
}
```

**Rehydration** happens in `AppContext` on app launch:
1. `rehydrate()` in `store/authStore.ts` reads the stored access token
2. Calls `GET /api/auth/me` to validate it
3. If valid → sets `_user` in the singleton store → `isAuthenticated = true`
4. If invalid → clears tokens → `isAuthenticated = false` → guard redirects to `/login`

---

## Password requirements

Enforced by both the mobile form (`app/signup.tsx`) and the server validator (`validators/auth.validator.ts`):

- Minimum 8 characters
- At least one uppercase letter (`[A-Z]`)
- At least one lowercase letter (`[a-z]`)
- At least one digit (`[0-9]`)
- At least one special character from `!@#$%^&*()_+-=[]{};':"\\|,.<>/?`

Passwords are hashed with **bcrypt cost 12** — never stored as plaintext.

---

## Two-factor authentication (TOTP)

Shield supports TOTP-based 2FA using the `otplib` library (RFC 6238 / TOTP).

### Setup flow
1. `POST /api/auth/2fa/setup` → server generates a TOTP secret, stores it (select:false on schema), returns QR code data URI
2. User scans QR code with an authenticator app (Google Authenticator, Authy, etc.)
3. `POST /api/auth/2fa/verify` with a valid OTP → sets `twoFactorEnabled: true`

### Login with 2FA
1. `POST /api/auth/login` with email+password
2. If `twoFactorEnabled`, server throws `401 MFA_REQUIRED`
3. Mobile shows an OTP input field
4. Re-submit with `{ email, password, otp }` → success

### Disable 2FA
`POST /api/auth/2fa/disable` requires the account password — OTP alone is not sufficient.

### Sign in with Google
1. Mobile prompts the Google account chooser via `expo-auth-session` (Google provider).
2. `POST /api/auth/google { idToken }` — server verifies the ID token with `google-auth-library`.
3. The user is matched by `googleSub`, falling back to the verified Google email.
4. Matching an existing email/password account links it to Google (sets `googleSub`).
5. New accounts are auto-registered (random `passwordHash` — Google users have no password yet) and their default Settings are seeded.
6. Response is identical to login: `{ token, accessToken, refreshToken, user, isNewUser }`.

Server-side ID token verification requires `GOOGLE_CLIENT_ID` in `server/.env`.

---

## Forgot password flow

> In development the reset token is **logged to the server console**, not emailed. In production, wire `userService.forgotPassword()` to your email provider.

```
POST /api/auth/forgot-password { email }
   │
   ▼
Find user by email (no error if not found — prevents enumeration)
   │
   ▼
Generate 32-byte random token
Store SHA-256(token) in password_reset_tokens collection (expires in 1h)
   │
   ▼
[DEV] Log: "[SIMULATED EMAIL] Password reset token for user@example.com: <token>"
   │
   ▼
Response: { success: true, message: "If an account exists, a reset link was sent." }

POST /api/auth/reset-password { token, password, confirmPassword }
   │
   ▼
Hash(token) → find in DB → check not used, not expired
   │
   ▼
bcrypt.hash(newPassword, 12) → update user.passwordHash
Mark token as used
Revoke ALL existing refresh tokens for that user
   │
   ▼
Response: { success: true, message: "Password has been successfully reset" }
```

---

## Rate limiting on auth endpoints

`authLimiter`: 20 requests per 15-minute window per IP (configured in `server/.env` as `AUTH_RATE_LIMIT_MAX`).

Applies to: `/register`, `/login`, `/refresh`, `/forgot-password`, `/reset-password`.

---

## Roles

The `User` model has a `role` field: `"user"` | `"admin"`. Currently all registered users receive the `"user"` role. Admin functionality is reserved for future implementation. Role is stored in MongoDB but not included in the JWT payload — it is always re-read from the database on protected admin routes.
