# Setup Guide — Shield App

Complete local development setup from zero to a running app.

---

## Prerequisites

| Tool | Required version | Install |
|---|---|---|
| Node.js | ≥ 18.0.0 | https://nodejs.org |
| pnpm | ≥ 11.0 | `npm i -g pnpm` |
| Expo Go (mobile) | Latest | iOS App Store / Google Play |
| MongoDB Atlas account | Free tier | https://cloud.mongodb.com |

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
# ── MongoDB ───────────────────────────────────────────────────────────────────
# Get this from your Atlas cluster → Connect → Drivers
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/shield?retryWrites=true&w=majority
MONGODB_DATABASE_NAME=shield

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

### MongoDB Atlas setup

1. Create a free cluster at https://cloud.mongodb.com
2. Create a database user with `readWrite` on the `shield` database
3. Add your IP to the Network Access allowlist (or `0.0.0.0/0` for dev)
4. Copy the connection string into `MONGODB_URI`

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
```

> **Never** put `MONGODB_URI`, `JWT_SECRET`, or any server secret here. Expo inlines `EXPO_PUBLIC_*` vars into the JS bundle — they are visible to anyone who decompiles the app.

---

## 4. Start the backend

```bash
cd server
pnpm dev
```

Expected output:
```
MongoDB connection attempt 1/5…
✅ MongoDB connected — database: "shield"
Shield API listening on http://0.0.0.0:3001
Environment: development
```

Verify the server is healthy:
```bash
curl http://localhost:3001/api/health
# {"success":true,"databaseStatus":"connected",...}
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
5. Dashboard loads with live data from MongoDB

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

### MongoDB connection fails

1. Check `MONGODB_URI` in `server/.env` — no trailing spaces, correct password
2. Atlas → Network Access → confirm your IP is whitelisted
3. Atlas → Database Access → confirm the user has `readWrite` on `shield`

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
| `MONGODB_URI` | ✅ | MongoDB Atlas connection string |
| `MONGODB_DATABASE_NAME` | ✅ | Database name (`shield`) |
| `JWT_SECRET` | ✅ | 64-byte hex string for signing JWTs |
| `JWT_EXPIRES_IN` | ✅ | Access token TTL (e.g. `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | ✅ | Refresh token TTL (e.g. `30d`) |
| `ENCRYPTION_KEY` | ✅ | 64-char hex for AES-256-GCM audit encryption |
| `PORT` | optional | Server port (default `3001`) |
| `CORS_ORIGINS` | optional | Comma-separated allowed origins |
| `LOG_LEVEL` | optional | `debug` / `info` / `warn` / `error` |

### `artifacts/mobile/.env` (safe to commit — no secrets)

| Variable | Required | Description |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | ✅ | Backend URL (LAN IP or tunnel) |
