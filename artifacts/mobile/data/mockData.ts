/**
 * Mock data layer — the canonical source of truth for demo mode.
 * DEMO_MODE defaults to false since we have a real backend.
 * Set to true to bypass API calls and use this data directly.
 */

export const DEMO_MODE = false;

export const MOCK_PROTECTION_STATUS = {
  overall: "action_needed" as const,
  score: 72,
  permissionsStatus: "warning" as const,
  networkStatus: "danger" as const,
  phishingStatus: "safe" as const,
  antitheftStatus: "safe" as const,
  lastScanAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
  threatsBlocked: 14,
  appsScanned: 47,
  linksScanned: 203,
};

export const MOCK_APPS = [
  {
    id: "1",
    name: "QuickCalc Pro",
    packageName: "com.quickcalc.pro",
    category: "utility",
    requestedPermissions: ["SMS", "CONTACTS", "LOCATION", "CAMERA"],
    riskScore: 88,
    riskLevel: "critical" as const,
    riskReasons: [
      "Calculator app requesting SMS access — highly unusual",
      "Contacts access not needed for calculations",
      "Location access unexpected for a utility app",
    ],
    lastScannedAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
  },
  {
    id: "2",
    name: "FitTrack Plus",
    packageName: "com.fittrack.plus",
    category: "health",
    requestedPermissions: ["MICROPHONE", "LOCATION", "CAMERA"],
    riskScore: 52,
    riskLevel: "medium" as const,
    riskReasons: [
      "Microphone access requested — verify if needed for your use",
      "Location + Camera combination warrants review",
    ],
    lastScannedAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
  },
  {
    id: "3",
    name: "NoteKeeper",
    packageName: "com.notekeeper.app",
    category: "productivity",
    requestedPermissions: ["STORAGE", "INTERNET"],
    riskScore: 8,
    riskLevel: "safe" as const,
    riskReasons: [],
    lastScannedAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
  },
  {
    id: "4",
    name: "WeatherNow",
    packageName: "com.weathernow.app",
    category: "weather",
    requestedPermissions: ["LOCATION", "INTERNET", "NOTIFICATION"],
    riskScore: 18,
    riskLevel: "low" as const,
    riskReasons: [
      "Location access expected for weather — permissions look appropriate",
    ],
    lastScannedAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
  },
  {
    id: "5",
    name: "FlashLite",
    packageName: "com.flashlite.app",
    category: "utility",
    requestedPermissions: ["CAMERA", "SMS", "CALL_LOG"],
    riskScore: 76,
    riskLevel: "high" as const,
    riskReasons: [
      "Flashlight app requesting SMS and Call Log — highly suspicious",
      "No legitimate reason for a flashlight to access call history",
    ],
    lastScannedAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
  },
];

export const MOCK_NETWORK = {
  ssid: "Starbucks_Guest",
  isSecured: false,
  signalStrength: -68,
  speedMbps: 12.4,
  riskLevel: "danger" as const,
  vpnConnected: false,
  vpnSession: undefined,
};

export const MOCK_PHISHING_LOG = [
  {
    id: "ph1",
    domain: "paypa1-secure.com",
    verdict: "malicious" as const,
    threatType: "SOCIAL_ENGINEERING",
    source: "manual_check" as const,
    checkedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "ph2",
    domain: "github.com",
    verdict: "safe" as const,
    source: "manual_check" as const,
    checkedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "ph3",
    domain: "netflix.com",
    verdict: "safe" as const,
    source: "auto_scan" as const,
    checkedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
  },
];

export const MOCK_DEVICE = {
  deviceName: "Alex's iPhone 15",
  status: "online" as const,
  batteryPercent: 73,
  lastSeenAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
  locationAvailable: true,
  latitude: 37.7749,
  longitude: -122.4194,
  locationLabel: "San Francisco, CA",
  simStatus: "Active",
  gpsPrecision: "±8m",
  networkEncryption: "WPA3",
  pendingAction: "none" as const,
  actionStatus: "idle" as const,
};

export const MOCK_SETTINGS = {
  webProtectionEnabled: true,
  vpnAutoConnect: true,
  killSwitchEnabled: false,
  notifyHighRiskApps: true,
  notifyPhishingThreats: true,
  notifyDeviceUnlock: false,
  twoFactorEnabled: true,
  lastLoginAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  accountEmail: "alex@example.com",
  linkedDeviceCount: 1,
};
