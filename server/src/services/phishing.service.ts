import { randomUUID } from "node:crypto";
import { PhishingCheck, IPhishingCheck, PhishingVerdict } from "../models/PhishingCheck";
import { SecurityEvent } from "../models/SecurityEvent";
import { Device } from "../models/Device";
import { z } from "zod";
import { logger } from "../utils/logger";

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

const virusTotalResponseSchema = z.object({
  data: z.object({
    attributes: z.object({
      last_analysis_stats: z.object({
        malicious: z.number().int().nonnegative(),
        suspicious: z.number().int().nonnegative(),
      }).passthrough(),
    }),
  }),
});

const HOSTNAME_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

async function lookupDomainReputation(domain: string): Promise<PhishingVerdict | null> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  const normalizedDomain = domain.toLowerCase().replace(/\.$/, "");
  if (!apiKey || !HOSTNAME_PATTERN.test(normalizedDomain)) return null;

  try {
    const response = await fetch(
      `https://www.virustotal.com/api/v3/domains/${encodeURIComponent(normalizedDomain)}`,
      {
        headers: { "x-apikey": apiKey },
        signal: AbortSignal.timeout(3500),
      }
    );
    if (!response.ok) return null;

    const parsed = virusTotalResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      logger.warn("VirusTotal returned an unexpected domain reputation response");
      return null;
    }

    const stats = parsed.data.data.attributes.last_analysis_stats;
    if (stats.malicious > 0) return "malicious";
    if (stats.suspicious > 0) return "suspicious";
    return "safe";
  } catch (error) {
    logger.warn(`VirusTotal domain lookup failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function analyzeUrl(urlHash: string, domain: string): Promise<{
  verdict: PhishingVerdict;
  threatType: string | null;
}> {
  const d = domain.toLowerCase();

  // Only the hostname and existing short hash are used; the original URL is
  // never sent to the external threat-intelligence provider.
  const reputation = await lookupDomainReputation(d);
  if (reputation === "malicious") {
    return { verdict: "malicious", threatType: "PHISHING" };
  }
  if (reputation === "suspicious") {
    return { verdict: "suspicious", threatType: "SOCIAL_ENGINEERING" };
  }
  if (reputation === "safe") return { verdict: "safe", threatType: null };

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

  // Retain the URL hash for future privacy-preserving reputation cache lookups.
  void urlHash;

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
    const { verdict, threatType } = await analyzeUrl(urlHash, domain);

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
