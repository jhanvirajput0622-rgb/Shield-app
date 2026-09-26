import { randomUUID } from "node:crypto";
import { PhishingCheck, IPhishingCheck, PhishingVerdict } from "../models/PhishingCheck";
import { SecurityEvent } from "../models/SecurityEvent";
import { Device } from "../models/Device";

// ─── Threat intelligence heuristic ───────────────────────────────────────────
// Replace / extend this with a real threat-intel API (e.g. Google Safe Browsing,
// VirusTotal) without changing any callers.

const MALICIOUS_KEYWORDS = [
  "paypa1", "paypal-login", "login-update", "verify-account",
  "bank-secure", "appleid-verify", "amaz0n", "account-suspended",
];

const SUSPICIOUS_KEYWORDS = [
  "login.", "signin.", "secure-", "verify-", "update-account",
];

function analyzeUrl(urlHash: string, domain: string): {
  verdict: PhishingVerdict;
  threatType: string | null;
} {
  const d = domain.toLowerCase();

  for (const keyword of MALICIOUS_KEYWORDS) {
    if (d.includes(keyword)) {
      return { verdict: "malicious", threatType: "PHISHING" };
    }
  }

  for (const keyword of SUSPICIOUS_KEYWORDS) {
    if (d.includes(keyword)) {
      return { verdict: "suspicious", threatType: "SOCIAL_ENGINEERING" };
    }
  }

  // Known-safe TLDs heuristic — real implementation would query a threat DB
  // using only the urlHash (not the full URL) to preserve privacy
  void urlHash; // reserved for hash-based lookup

  return { verdict: "safe", threatType: null };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class PhishingService {
  async checkUrl(
    userId: string,
    urlHash: string,
    domain: string,
    encryptedUrl: string,
    source: IPhishingCheck["source"]
  ): Promise<IPhishingCheck> {
    const { verdict, threatType } = analyzeUrl(urlHash, domain);

    // Get primary device for the user (nullable — OK)
    const device = await Device.findOne({ userId }).sort({ lastSeenAt: -1 });
    const deviceId = device?._id ?? randomUUID();

    const check = await PhishingCheck.create({
      userId,
      deviceId,
      urlHash,
      encryptedUrl: encryptedUrl ?? "",
      domain,
      verdict,
      threatType,
      source,
      checkedAt: new Date(),
    });

    // Emit a security event for malicious / suspicious results
    if (verdict === "malicious" || verdict === "suspicious") {
      await SecurityEvent.create({
        userId,
        deviceId,
        eventType: "phishing_detected",
        severity: verdict === "malicious" ? "high" : "medium",
        title: verdict === "malicious" ? "Malicious Link Blocked" : "Suspicious Link Flagged",
        description: `Threat type: ${threatType ?? "unknown"} on domain: ${domain}`,
        isBlocked: verdict === "malicious",
        occurredAt: new Date(),
      });
    }

    return check;
  }

  async getLog(
    userId: string,
    limit = 50
  ): Promise<{
    entries: IPhishingCheck[];
    totalScanned: number;
    threatsBlocked: number;
  }> {
    const [entries, totalScanned, threatsBlocked] = await Promise.all([
      (PhishingCheck.find({ userId })
        .sort({ checkedAt: -1 })
        .limit(limit) as unknown as Promise<IPhishingCheck[]>),
      PhishingCheck.countDocuments({ userId }),
      PhishingCheck.countDocuments({ userId, verdict: "malicious" }),
    ]);

    return { entries, totalScanned, threatsBlocked };
  }

  async clearLog(userId: string): Promise<void> {
    await PhishingCheck.deleteMany({ userId });
  }
}

export const phishingService = new PhishingService();
