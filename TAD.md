# Technical Architecture Document (TAD): Shield App

## 1. Executive Summary
This document outlines the technical architecture for **Shield**, a privacy-first mobile security application. The architecture is designed to prioritize performance, security, and developer velocity. It utilizes a monorepo structure to share types and API clients seamlessly between the mobile client and the backend services.

---

## 2. Recommended Technology Stack & Reasoning

### Frontend (Mobile App)
- **Framework:** React Native with Expo
  - *Reasoning:* Expo provides the fastest time-to-market for cross-platform (iOS & Android) mobile apps. With Expo Router, we get file-based routing out of the box, and Expo's native modules allow us to access necessary device APIs (Location, Biometrics, Camera) seamlessly.
- **State Management & Data Fetching:** React Query (`@tanstack/react-query`)
  - *Reasoning:* Handles caching, background syncing, and stale-data management automatically. Crucial for a security app that frequently polls for device status and threat updates.
- **Animations:** React Native Reanimated & Expo Haptics
  - *Reasoning:* Provides 60-120fps fluid animations on the UI thread, essential for the "high-tech" security feel we are targeting.
- **Cryptography:** `tweetnacl`
  - *Reasoning:* A highly secure, audited cryptographic library for Javascript. Used for generating E2E encryption keys locally on the device.

### Backend (API Server)
- **Framework:** Node.js with Fastify
  - *Reasoning:* Fastify is exceptionally fast and has lower overhead compared to Express. It integrates perfectly with TypeScript and has excellent schema validation built-in, making it ideal for a high-throughput security API.
- **Database ODM:** Mongoose
  - *Reasoning:* Provides robust modeling, schema validation, and strict type safety for MongoDB.
- **Database Engine:** MongoDB Atlas
  - *Reasoning:* A highly scalable NoSQL database ideal for flexible schemas, rapid iteration, and storing hierarchical JSON data like device telemetry and security events.

### Infrastructure & Tooling
- **Monorepo Manager:** Turborepo & pnpm workspaces
  - *Reasoning:* Allows us to keep the backend, frontend, and shared libraries (like Zod validation schemas and API clients) in one repository. Turborepo caches builds to dramatically speed up CI/CD.

---

## 3. Project File & Folder Structure

We use a modern Monorepo architecture to maximize code sharing.

```text
Shield-app/
├── pnpm-workspace.yaml         # Defines the workspace packages
├── package.json                # Root dependencies (Turborepo, Husky)
├── turbo.json                  # Turborepo build pipeline configuration
│
├── apps/
│   ├── mobile/                 # Expo React Native App
│   │   ├── app/                # Expo Router screens (Tabs, Onboarding, etc.)
│   │   ├── components/         # Reusable UI components (Buttons, Modals)
│   │   ├── constants/          # Design tokens (Colors, Spacing)
│   │   ├── context/            # React Context (Auth, AppState)
│   │   ├── lib/                # Utilities (Cryptography, formatting)
│   │   └── package.json
│   │
│   ├── api-server/             # Fastify Node.js Backend
│   │   ├── prisma/             # Database schema and migrations
│   │   ├── src/
│   │   │   ├── routes/         # API Endpoints (e.g., /devices, /phishing)
│   │   │   ├── services/       # Business logic
│   │   │   └── index.ts        # Server entry point
│   │   └── package.json
│   │
│   └── web-dashboard/          # (Post-MVP) Next.js Web App for Anti-theft portal
│
└── packages/                   # Shared internal libraries
    ├── api-client-react/       # Auto-generated React Query hooks for the frontend
    ├── shared-types/           # TypeScript interfaces shared between frontend & backend
    └── eslint-config/          # Shared linting rules
```

---

## 4. Database Schema (MongoDB)

Below is the logical structure of our document database, explained in plain English.

### `User` Table
Stores the core account information for a customer.
- `id` (UUID): Unique identifier.
- `email` (String, Unique): User's login email.
- `passwordHash` (String): Securely hashed password.
- `createdAt` / `updatedAt` (DateTime): Timestamps.

### `Device` Table
Represents a physical smartphone registered to a User. A user can have multiple devices.
- `id` (UUID): Unique identifier.
- `userId` (UUID, Foreign Key): Links to the `User`.
- `name` (String): e.g., "John's iPhone 15".
- `osType` (String): "iOS" or "Android".
- `publicKey` (String): The public half of the E2E encryption key pair generated on the device. The private key never leaves the phone.
- `status` (Enum): "online", "offline", "lost", "wiped".
- `lastSeenAt` (DateTime): Timestamp of the last successful ping.

### `DeviceLocation` Table
A time-series table that logs where the device was, used specifically when the device is marked as "lost" (Anti-Theft).
- `id` (UUID).
- `deviceId` (UUID, Foreign Key): Links to the `Device`.
- `latitude` (Float) & `longitude` (Float): GPS coordinates.
- `accuracy` (Float): Radius of uncertainty in meters.
- `recordedAt` (DateTime): When the ping occurred.

### `CommandQueue` Table
Used for asynchronous Anti-Theft actions. When a user requests a "Wipe" from the web portal, it is queued here. The mobile app polls for pending commands.
- `id` (UUID).
- `deviceId` (UUID, Foreign Key): The target device.
- `commandType` (Enum): "LOCK", "WIPE", "LOCATE".
- `payload` (JSON): e.g., The custom lock screen message.
- `status` (Enum): "QUEUED", "DELIVERED", "ACKNOWLEDGED", "FAILED".
- `createdAt` / `executedAt` (DateTime).

### `PhishingScan` Table
Logs URLs that the user has checked for threats to display in their Activity Log.
- `id` (UUID).
- `deviceId` (UUID, Foreign Key): Which device performed the scan.
- `urlHash` (String): A cryptographic hash of the URL to protect privacy while allowing duplicate checks.
- `verdict` (Enum): "SAFE", "MALICIOUS", "UNKNOWN".
- `source` (Enum): "MANUAL_INPUT", "QR_SCAN".
- `scannedAt` (DateTime).

---

## 5. Environment Variables & Configuration Notes

Before starting local development, ensure the following `.env` files are configured in their respective directories.

### API Server (`apps/api-server/.env`)
- `MONGODB_URI="mongodb+srv://..."` : Connection string for the MongoDB database.
- `MONGODB_DATABASE_NAME="shield"` : The target database name.
- `JWT_SECRET="super-secret-string"` : Used for signing authentication tokens.
- `PORT=3000` : The port the Fastify server will listen on.
- `THREAT_INTEL_API_KEY="..."` : Third-party API key (e.g., Google Safe Browsing or VirusTotal) used to verify URLs in the phishing checker.

### Mobile App (`apps/mobile/.env.local`)
- `EXPO_PUBLIC_API_URL="http://localhost:3000"` : The URL of the local API server. Prefixed with `EXPO_PUBLIC_` so it is securely bundled into the client app.

### Security / Development Notes
1. **Network Setup:** When testing the React Native app on a physical device, the `localhost` API URL won't work out of the box. You must use your computer's local IP network address (e.g., `http://192.168.1.5:3000`) or use `ngrok`/`expo start --tunnel`.
2. **E2E Encryption:** Always ensure `tweetnacl` operations occur locally. The private key must be stored securely using Expo's `SecureStore` (which utilizes iOS Keychain / Android Keystore) and never transmitted to the API.
3. **Biometrics:** The Expo local-authentication module will automatically fall back to the device passcode if FaceID/TouchID fails. Account for this behavior when designing the "Remote Wipe" biometric gate.
