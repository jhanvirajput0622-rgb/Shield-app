/**
 * securityService — URL checking, QR checking, URL history, security events.
 *
 * PRIVACY: Full URLs are hashed + E2E encrypted on-device before being sent.
 * The server stores the hash and ciphertext only — it cannot read the raw URL.
 */
import { apiFetch } from "./api";

export type PhishingVerdict = "safe" | "malicious" | "suspicious" | "unknown";
export type EventSeverity = "info" | "low" | "medium" | "high" | "critical";

export interface UrlCheckResult {
  verdict: PhishingVerdict;
  threatType?: string;
  message: string;
  logEntry: {
    id: string;
    domain: string;
    verdict: PhishingVerdict;
    source: string;
    checkedAt: string;
  };
}

export interface UrlHistoryEntry {
  id: string;
  domain: string;
  verdict: PhishingVerdict;
  threatType?: string;
  source: string;
  checkedAt: string;
}

export interface UrlHistory {
  entries: UrlHistoryEntry[];
  totalScanned: number;
  threatsBlocked: number;
}

export interface SecurityEventItem {
  id: string;
  eventType: string;
  severity: EventSeverity;
  title: string;
  description: string;
  isBlocked: boolean;
  metadata: Record<string, unknown>;
  deviceId: string | null;
  occurredAt: string;
}

export interface SecurityEventsPage {
  success: boolean;
  data: SecurityEventItem[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

// ── POST /api/security/check-url ──────────────────────────────────────────────
export async function checkUrl(
  urlHash: string,
  domain: string,
  encryptedUrl?: string,
  source: "manual_check" | "auto_scan" | "sms" | "qr" = "manual_check"
): Promise<UrlCheckResult> {
  return apiFetch<UrlCheckResult>("/api/security/check-url", {
    method: "POST",
    body: { urlHash, domain, encryptedUrl, source },
  });
}

// ── POST /api/security/check-qr ──────────────────────────────────────────────
export async function checkQr(
  urlHash: string,
  domain: string,
  encryptedUrl?: string
): Promise<UrlCheckResult> {
  return apiFetch<UrlCheckResult>("/api/security/check-qr", {
    method: "POST",
    body: { urlHash, domain, encryptedUrl, source: "qr" },
  });
}

// ── GET /api/security/url-history ────────────────────────────────────────────
export async function getUrlHistory(): Promise<UrlHistory> {
  return apiFetch<UrlHistory>("/api/security/url-history");
}

// ── GET /api/security/events ─────────────────────────────────────────────────
export async function getSecurityEvents(
  page = 1,
  limit = 20
): Promise<SecurityEventsPage> {
  return apiFetch<SecurityEventsPage>(
    `/api/security/events?page=${page}&limit=${limit}`
  );
}
