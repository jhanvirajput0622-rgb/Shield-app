import { Request, Response } from "express";
import { phishingService } from "../services/phishing.service";
import { auditService } from "../services/audit.service";
import { CheckUrlBody, CheckQrBody } from "../validators/phishing.validator";
import { IPhishingCheck } from "../models/PhishingCheck";

function buildCheckResponse(check: IPhishingCheck) {
  const verdictMessage =
    check.verdict === "malicious"
      ? "Malicious Link Blocked"
      : check.verdict === "suspicious"
        ? "Suspicious Link — proceed with caution"
        : "Link appears safe";

  return {
    verdict: check.verdict,
    threatType: check.threatType ?? undefined,
    message: verdictMessage,
    logEntry: {
      id: check._id.toString(),
      domain: check.domain,
      verdict: check.verdict,
      source: check.source,
      checkedAt: check.checkedAt.toISOString(),
    },
  };
}

export const phishingController = {
  // ── GET /api/shield/phishing/log  |  GET /api/security/url-history ────────
  async getLog(req: Request, res: Response): Promise<void> {
    const { entries, totalScanned, threatsBlocked } =
      await phishingService.getLog(req.userId);

    res.json({
      entries: entries.map((e) => ({
        id: (e._id as { toString(): string }).toString(),
        domain: e.domain,
        verdict: e.verdict,
        threatType: e.threatType ?? undefined,
        source: e.source,
        checkedAt: (e.checkedAt as Date).toISOString(),
        // encryptedUrl intentionally omitted — server can't decrypt it
      })),
      totalScanned,
      threatsBlocked,
    });
  },

  // ── POST /api/shield/phishing/check  |  POST /api/security/check-url ──────
  async checkUrl(req: Request, res: Response): Promise<void> {
    const { urlHash, domain, encryptedUrl, source } = req.body as CheckUrlBody;

    const check = await phishingService.checkUrl(
      req.userId,
      urlHash,
      domain,
      encryptedUrl ?? "",
      source
    );

    auditService.log(req.userId, "URL_CHECK", `URL check: ${domain} → ${check.verdict}`, {
      metadata: { domain, verdict: check.verdict, source },
    }).catch(() => {});

    if (check.verdict === "malicious" || check.verdict === "suspicious") {
      auditService.log(req.userId, "THREAT_DETECTED", `Threat detected on ${domain}`, {
        metadata: { threatType: check.threatType, verdict: check.verdict },
      }).catch(() => {});
    }

    res.json(buildCheckResponse(check));
  },

  // ── POST /api/security/check-qr ───────────────────────────────────────────
  async checkQr(req: Request, res: Response): Promise<void> {
    const { urlHash, domain, encryptedUrl } = req.body as CheckQrBody;

    const check = await phishingService.checkUrl(
      req.userId,
      urlHash,
      domain,
      encryptedUrl ?? "",
      "qr"
    );

    res.json(buildCheckResponse(check));
  },

  // ── DELETE /api/shield/phishing/log ───────────────────────────────────────
  async clearLog(req: Request, res: Response): Promise<void> {
    await phishingService.clearLog(req.userId);
    res.json({ success: true });
  },
};
