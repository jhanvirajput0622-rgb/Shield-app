# Setup Guide — Shield App

Complete local development setup from zero to a running app.

---

## Prerequisites

| Tool | Required version | Install |
|---|---|---|
| Node.js | ≥ 18.0.0 | https://nodejs.org |
| pnpm | ≥ 11.0 | `npm i -g pnpm` |
| Expo Go (mobile) | Latest | iOS App Store / Google Play |
| Firebase project | Free tier available | https://console.firebase.google.com |

---

## 1. Clone and install

```bash
git clone <repo-url> Shield-app
cd Shield-app
pnpm install
```

`pnpm install` installs all workspace packages (root, `artifacts/mobile`, `server`, `lib/*`) in one step.

---

## 2. Configure the backend

```bash
cp server/.env.example server/.env
```

Open `server/.env` and fill in the required values:

```env
# ── Firebase Firestore ────────────────────────────────────────────────────────
FIREBASE_PROJECT_ID=shield-419e1
# Use Google Application Default Credentials locally, or provide a service account path.
# GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/firebase-service-account.json

# ── JWT ───────────────────────────────────────────────────────────────────────
# Generate a secure secret:
#   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=<64-byte-hex-string>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# ── Security ──────────────────────────────────────────────────────────────────
# Generate an AES-256 key for encrypting audit log details:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=<64-char-hex>

# ── Server ────────────────────────────────────────────────────────────────────
NODE_ENV=development
PORT=3001
LOG_LEVEL=debug

# ── CORS ─────────────────────────────────────────────────────────────────────
# Add your LAN IP when testing on a physical device (see step 5)
CORS_ORIGINS=http://localhost:8081,http://localhost:19006,exp://localhost:8081

# ── Rate limiting ─────────────────────────────────────────────────────────────
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=20
```

### Firebase setup

1. Create or select the Firebase project in the Firebase Console.
2. Enable Cloud Firestore in production or test mode.
3. Authenticate local development with Google Application Default Credentials.
4. Set `FIREBASE_PROJECT_ID` in `server/.env`.

Initialize the application collections after credentials are configured:

```bash
cd server
npm run db:bootstrap
```

---

## 3. Configure the mobile app

```bash
# The .env is already committed with a placeholder — edit it
nano artifacts/mobile/.env
```

```env
# ── IMPORTANT: localhost does NOT work on a physical device ──────────────────
# Use your machine's LAN IP instead of localhost.
#
# Find your LAN IP:
#   macOS/Linux : ifconfig | grep "inet " | grep -v 127
#   Windows     : ipconfig | findstr IPv4
#
# Examples:
#   Same WiFi network     : http://192.168.1.42:3001
#   Replit/tunnel         : https://<tunnel-url>
EXPO_PUBLIC_API_URL=http://192.168.1.42:3001

# Optional Google Sign-In (IDs are public client IDs, not secrets)
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<Google Web client ID>
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<Google iOS client ID>
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<Google Android client ID>
```

> **Never** put `GOOGLE_APPLICATION_CREDENTIALS`, service-account JSON, `JWT_SECRET`, or any server secret here. Expo inlines `EXPO_PUBLIC_*` vars into the JS bundle — they are visible to anyone who decompiles the app.

For Google sign-in, also set the same Web client ID as `GOOGLE_CLIENT_ID` in `server/.env`. For email-code sign-in, configure `RESEND_API_KEY`, `EMAIL_FROM` (a sender on a verified Resend domain), and a random 32-byte `OTP_HASH_SECRET` there. Generate the OTP secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`; never put these server values in the mobile `.env`.

---

## 4. Start the backend

```bash
cd server
pnpm dev
```

Expected output:
```
Firestore connectivity check started
Shield API listening on http://0.0.0.0:3001
Environment: development
```

Verify the server is healthy:
```bash
curl http://localhost:3001/api/health
# {"success":true,"database":"Firestore","databaseStatus":"connected",...}
```

---

## 5. Start the mobile app

In a new terminal:

```bash
cd artifacts/mobile
pnpm dev   # runs: expo start --tunnel
```

Scan the QR code with **Expo Go** on your phone.

> **Why `--tunnel`?** The tunnel creates a public HTTPS URL that your phone can reach over any internet connection, regardless of network. The `EXPO_PUBLIC_API_URL` in `.env` still points to your server — make sure the server is accessible from the phone (either via LAN IP or a tunnel like ngrok).

### Running on a simulator (no physical device needed)

```bash
# iOS Simulator (macOS only)
cd artifacts/mobile && npx expo start --ios

# Android Emulator
cd artifacts/mobile && npx expo start --android
```

---

## 6. Available commands

### Root workspace

| Command | What it does |
|---|---|
| `pnpm run typecheck` | Full TypeScript check across all packages |
| `pnpm run build` | Typecheck + build all packages |

### Backend (`server/`)

| Command | What it does |
|---|---|
| `pnpm dev` | Start dev server with hot-reload (ts-node-dev) |
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm start` | Run compiled production build |
| `pnpm typecheck` | TypeScript check only, no emit |
| `pnpm db:init` | Run database initialization script |

### Mobile (`artifacts/mobile/`)

| Command | What it does |
|---|---|
| `pnpm dev` | Start Expo dev server with tunnel |
| `pnpm start` | Start Expo dev server (no tunnel) |
| `pnpm typecheck` | TypeScript check only |

---

## 7. First-time user flow

1. Open the app → Login screen appears (auth guard redirects automatically)
2. Tap **Create Account** → fill in name, email, phone (optional), password
3. Agree to Terms → **Create Account**
4. Onboarding slides appear → tap **Get Started**
5. Dashboard loads with live data from Firestore

---

## 8. Troubleshooting

### "Cannot connect to server" on physical device

`localhost` resolves to the phone itself, not your dev machine. Use your **LAN IP**:
```bash
# macOS/Linux
ifconfig | grep "inet " | grep -v 127
# Example output: inet 192.168.1.42

# Update artifacts/mobile/.env
EXPO_PUBLIC_API_URL=http://192.168.1.42:3001
```

Then restart Expo (`r` in the terminal, or `Ctrl+C` + `pnpm dev`).

### "Invalid key provided to SecureStore"

This was a known bug (keys contained `@` and `/`). It was fixed in `lib/secureStorage.ts`. If you still see it, make sure you're running the latest code and clear the app's storage:
- iOS Simulator: **Device → Erase All Content and Settings**
- Android Emulator: **Cold Boot** the AVD

### Firestore connection fails

1. Check `FIREBASE_PROJECT_ID` in `server/.env`.
2. Confirm Application Default Credentials are available, or `GOOGLE_APPLICATION_CREDENTIALS` points to a valid service-account JSON file.
3. Confirm Cloud Firestore is enabled for the Firebase project.

### TypeScript errors after `pnpm install`

```bash
cd artifacts/mobile && pnpm typecheck 2>&1 | head -30
cd server && pnpm typecheck 2>&1 | head -30
```

Most common causes:
- Missing `@workspace/api-client-react` — run `pnpm install` from the repo root
- Stale `tsconfig.tsbuildinfo` — delete it and retry

---

## 9. Environment variable summary

### `server/.env` (never commit)

| Variable | Required | Description |
|---|---|---|
| `FIREBASE_PROJECT_ID` | ✅ | Firebase project ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | optional | Path to a service-account JSON file, or use Google Application Default Credentials |
| `JWT_SECRET` | ✅ | 64-byte hex string for signing JWTs |
| `JWT_EXPIRES_IN` | ✅ | Access token TTL (e.g. `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | ✅ | Refresh token TTL (e.g. `30d`) |
| `ENCRYPTION_KEY` | ✅ | 64-char hex for AES-256-GCM audit encryption |
| `PORT` | optional | Server port (default `3001`) |
| `CORS_ORIGINS` | optional | Comma-separated allowed origins |
| `LOG_LEVEL` | optional | `debug` / `info` / `warn` / `error` |
| `GOOGLE_CLIENT_ID` | optional | Google Web OAuth client ID used to verify ID tokens |
| `RESEND_API_KEY` | required for email OTP | Resend API key; keep server-side |
| `EMAIL_FROM` | required for email OTP | Sender address on your verified Resend domain |
| `OTP_HASH_SECRET` | required for email OTP | Random 32-byte secret for hashing email challenges |

### `artifacts/mobile/.env` (safe to commit — no secrets)

| Variable | Required | Description |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | ✅ | Backend URL (LAN IP or tunnel) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | optional | Google Web OAuth client ID |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | optional | Google iOS OAuth client ID |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | optional | Google Android OAuth client ID |
