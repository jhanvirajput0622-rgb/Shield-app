# Mobile App Guide — Shield

Architecture, screens, navigation, hooks, state management, and component reference.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK 57 (managed workflow) |
| Runtime | React Native 0.81.5 / React 19.1.0 |
| Navigation | Expo Router 6 (file-based, Stack + Tabs) |
| Server state | TanStack React Query v5 |
| Auth state | Module-level singleton + React hook (`store/authStore.ts`) |
| App state | React Context (`context/AppContext.tsx`) |
| Token storage | `expo-secure-store` (native) / AsyncStorage (web) |
| E2E encryption | `tweetnacl` (nacl.secretbox, SHA-512) |
| HTTP client | Custom `fetch` wrapper (`lib/apiClient.ts`) |
| Generated hooks | Orval v8 → `@workspace/api-client-react` |
| Icons | `@expo/vector-icons` (Feather set) |
| Fonts | Inter 400/500/600/700 (`@expo-google-fonts/inter`) |
| Animations | React Native Animated API + Reanimated 4 |

---

## Folder structure

```
artifacts/mobile/
├── app/                     Expo Router screens
│   ├── _layout.tsx          Root Stack + AuthGuard + QueryClientProvider
│   ├── (tabs)/
│   │   ├── _layout.tsx      Tab bar (Dashboard, Protection, Apps, Settings)
│   │   ├── index.tsx        Dashboard screen
│   │   ├── protection.tsx   Protection overview screen
│   │   ├── app.tsx          App permissions scanner screen
│   │   └── settings.tsx     Settings screen
│   ├── login.tsx            Login screen
│   ├── signup.tsx           Sign up screen
│   ├── forgot-password.tsx  Forgot password screen
│   ├── onboarding.tsx       4-slide onboarding carousel
│   ├── network.tsx          VPN / Network security screen
│   ├── phishing.tsx         Web protection / URL checker screen
│   └── antitheft.tsx        Anti-theft: locate, lock, wipe
├── components/
│   ├── ErrorBoundary.tsx    React class error boundary
│   ├── ErrorFallback.tsx    Error fallback UI
│   ├── KeyboardAwareScrollViewCompat.tsx
│   └── ui/
│       ├── BottomSheet.tsx  Animated modal sheet with optional confirmation
│       ├── CautionState.tsx Warning/error banner (never shows green)
│       ├── LoadingState.tsx Animated loading screen (cross-platform)
│       ├── LogRow.tsx       Phishing activity log entry
│       ├── ModuleCard.tsx   2×2 security module card
│       ├── ShieldRing.tsx   Animated concentric ring with score
│       └── StatusPill.tsx   Colored dot + label badge
├── constants/
│   └── colors.ts            Single source of truth for the dark theme
├── context/
│   └── AppContext.tsx       Onboarding state + E2E device key + auth rehydration
├── data/
│   └── mockData.ts          Fallback mock data (DEMO_MODE=false by default)
├── hooks/
│   ├── useAntiTheft.ts      Anti-theft device queries + lock/wipe mutations
│   ├── useAuth.ts           useLogin, useRegister, useLogout, useRefreshToken, useForgotPassword, useResetPassword
│   ├── useColors.ts         Returns active color palette (always dark in v1)
│   ├── useDashboard.ts      GET /api/shield/status
│   ├── useDbHealth.ts       GET /api/health (polls every 30s)
│   ├── useNetwork.ts        VPN state + connect/disconnect mutations
│   └── usePhishing.ts       Phishing log + URL check mutation
├── lib/
│   ├── apiClient.ts         fetch wrapper, token storage, silent refresh
│   ├── crypto.ts            E2E encryption (nacl.secretbox), URL hashing
│   ├── secureStorage.ts     Validated SecureStore wrapper (key validation)
│   └── utils.ts             riskColor, timeAgo, overallStatusColor/Label
├── store/
│   └── authStore.ts         Module singleton: _user, isAuthenticated, rehydrate()
└── app.json                 Expo config: slug, scheme, permissions
```

---

## Navigation structure

```
Root Stack (_layout.tsx)
│
├── (tabs)                   ← Tab group (authenticated users)
│   ├── index               Dashboard
│   ├── protection          Protection overview
│   ├── app                 App permissions scanner
│   └── settings            Settings
│
├── onboarding              ← Shown to new users before Dashboard
├── login                   ← Public
├── signup                  ← Public
├── forgot-password         ← Public
├── network                 ← Network security / VPN (modal-style)
├── phishing                ← Web protection / URL checker
└── antitheft               ← Anti-theft controls
```

**Auth guard logic:**
- Unauthenticated user navigating to any non-public screen → `/login`
- Public segments: `login`, `signup`, `forgot-password`, `onboarding`
- Authenticated users can freely navigate to login/signup (no forced redirect away)

---

## Screens

### Dashboard (`(tabs)/index.tsx`)
- **Data:** `useDashboard()` → `GET /api/shield/status`
- **Shows:** protection score, module statuses, stats row (threats/apps/links), recent security events
- **DB health banner:** `useDbHealth()` polls `/api/health` — shows yellow warning when DB is disconnected
- **Pull-to-refresh:** refetches dashboard stats
- **Error state:** full-screen error with retry button

### Protection (`(tabs)/protection.tsx`)
- **Data:** `useGetProtectionStatus()`, `useGetNetworkStatus()` from generated `@workspace/api-client-react`
- **Quick Scan button:** calls `useRunPermissionScan()` then invalidates 4 query keys
- **Module cards 2×2:** App Permissions → `/(tabs)/app`, Network → `/network`, Web Protection → `/phishing`, Anti-Theft → `/antitheft`
- **Fallback:** `MOCK_PROTECTION_STATUS` / `MOCK_NETWORK` when API fails

### App Permissions (`(tabs)/app.tsx`)
- **Data:** `useGetPermissions()` from generated client
- **Run Full Scan:** `useRunPermissionScan().mutateAsync()` — sends installed app list to server for risk scoring
- **States:** idle → scanning → complete / error
- **App detail sheet:** `BottomSheet` with permissions + risk reasons per app
- **Error banner:** `CautionState` with Retry Scan button when scan fails

### Settings (`(tabs)/settings.tsx`)
- **Data:** `useGetShieldSettings()` / `useUpdateShieldSettings()` from generated client
- **Sections:** Account, Notifications (3 toggles + OS permission gate), Security (2FA + last login), Legal
- **Logout:** calls `useAuthStore().logout()` + navigates to `/login`
- **Delete account:** `DELETE /api/users/me` (real API call) then logout

### Login (`login.tsx`)
- Validates email format + password
- Handles MFA: if server returns `MFA_REQUIRED`, shows OTP input field
- Remember Me checkbox → stored in AsyncStorage via `setRememberMe()`
- "Continue with Google" → `POST /api/auth/google` (ID token verification; auto-registers new users)
- On success: `setUser()` → `router.replace("/(tabs)")`

### Sign Up (`signup.tsx`)
- Fields: Full Name, Email, Password, Confirm Password
- Password strength bar (5-segment, color-coded)
- Terms checkbox (required)
- "Continue with Google" as an alternative sign-up path
- On success: `setUser()` → `router.replace("/onboarding")`

### Forgot Password (`forgot-password.tsx`)
- Submits email to `POST /api/auth/forgot-password`
- Always shows success state (prevents email enumeration)
- In dev: token is logged in server console

### Network (`network.tsx`)
- **Data:** `useNetwork()` → `GET /api/shield/network`
- **VPN toggle:** animated, three states: disconnected / connecting / connected
- **Session details card:** local IP, protocol (WireGuard), server location, encryption
- **Settings:** auto-connect, kill switch — persisted via `PATCH /api/shield/settings`

### Phishing (`phishing.tsx`)
- **Data:** `usePhishing()` → `GET /api/shield/phishing/log`
- **URL check:** input + QR camera button; URL is hashed + E2E encrypted before sending
- **QR scanner:** full-screen modal with viewfinder overlay (`expo-camera`)
- **Results:** safe (green row), malicious (`CautionState` error), unknown (`CautionState` caution)
- **Web protection toggle:** persisted via `PATCH /api/shield/settings`

### Anti-Theft (`antitheft.tsx`)
- **Data:** `useAntiTheft()` → `GET /api/shield/device` (polls every 30s)
- **Locate:** real GPS via `expo-location` → `POST /api/shield/device/locate`
- **Lock:** `BottomSheet` with message input → `POST /api/shield/device/lock`
- **Wipe:** biometric gate (`expo-local-authentication`) → confirmation sheet → `POST /api/shield/device/wipe`
- **Command polling:** client-side sentinel `commandRef` enables polling the device status every 3s

---

## State management

### TanStack React Query
All server state (caching, background refetch, mutations). Query keys are centralized in the generated `@workspace/api-client-react`.

### Auth store (`store/authStore.ts`)
Module-level singleton — no Redux/Zustand needed:
```ts
let _user: AuthUser | null = null;
let _loading = true;
const _listeners = new Set<Listener>();
```
`useAuthStore()` subscribes via a simple forceRender pattern. Functions: `setUser()`, `clearUser()`, `rehydrate()`.

### App context (`context/AppContext.tsx`)
- `hasOnboarded` — loaded from `AsyncStorage` key `@shield/onboarded`
- `deviceKey` — 256-bit E2E key from `lib/crypto.ts` (stored in SecureStore)
- `completeOnboarding()` — sets the AsyncStorage flag

---

## E2E encryption

Shield encrypts sensitive data **before** it leaves the device.

```
URL input by user
    │
    ▼
extractDomain()     → "paypal.com"      (sent as plaintext display domain)
hashUrl()           → "a3f2b1c4..."     (SHA-512 prefix, 16 hex chars — for dedup lookups)
encryptSensitive()  → base64(nonce|box) (nacl.secretbox with device key)
    │
    ▼
POST /api/shield/phishing/check { urlHash, domain, encryptedUrl }
    │
Server stores:
  - domain (plaintext)
  - urlHash (for dedup)
  - encryptedUrl (ciphertext — server cannot decrypt)
```

The device key is stored in `expo-secure-store` under key `shield.e2e_key`. It is **never** sent to the server.

---

## Design system (`constants/colors.ts`)

Shield uses a single dark palette — "control room" aesthetic, dark-only for v1.

| Token | Hex | Use |
|---|---|---|
| `background` | `#0A0E13` | Screen backgrounds |
| `surface` | `#12181F` | Cards |
| `elevated` | `#1A222B` | Nested elements, inputs |
| `border` | `#242D38` | Borders |
| `primary` | `#2FE6C3` | Teal/cyan accent |
| `foreground` | `#F3F6F9` | Primary text |
| `mutedForeground` | `#93A1B0` | Secondary text |
| `safe` | `#34D399` | Protected status |
| `warning` | `#FBBF24` | Caution |
| `danger` | `#F87171` | High risk |
| `critical` | `#EF4444` | Critical / destructive |

---

## Mock data

`data/mockData.ts` — `DEMO_MODE = false` by default. All screens fall back to mock data when the API returns an error or no data, ensuring the app is always demonstrable without a running backend.

---

## Generated API client

`lib/api-clients-react/` is generated by **Orval** from `lib/api-spec/openapi.yaml`.

Re-generate after changing the spec:
```bash
pnpm --filter @workspace/api-spec run codegen
```

Used by: `protection.tsx`, `app.tsx`, `settings.tsx`, `network.tsx`, `phishing.tsx`.

Custom hooks (`hooks/`) use `apiFetch` directly and are used by: `index.tsx`, `network.tsx`, `phishing.tsx`, `antitheft.tsx`.
