import { FastifyInstance } from "fastify";

// In-memory log — replace with MongoDB collection once integrated
const phishingLog: Array<{
  id: string;
  domain: string;
  verdict: string;
  threatType?: string;
  source: string;
  checkedAt: Date;
}> = [];

export default async function phishingRoutes(app: FastifyInstance) {
  app.get("/api/phishing/log", async (request, reply) => {
    const entries = phishingLog.map(s => ({
      id: s.id,
      domain: s.domain,
      verdict: s.verdict.toLowerCase(),
      threatType: s.threatType ?? undefined,
      source: s.source,
      checkedAt: s.checkedAt.toISOString(),
    }));

    return reply.send({
      entries,
      totalScanned: phishingLog.length,
      threatsBlocked: phishingLog.filter(s => s.verdict === "MALICIOUS").length,
    });
  });

  app.post("/api/phishing/check", async (request, reply) => {
    const body = request.body as any;

    const isMalicious =
      body.domain.includes("paypa1") || body.domain.includes("login-update");
    const verdict = isMalicious ? "MALICIOUS" : "SAFE";

    // TODO: persist to MongoDB
    const scan = {
      id: `scan-${Date.now()}`,
      domain: body.domain,
      verdict,
      source: "manual_check",
      checkedAt: new Date(),
    };
    phishingLog.unshift(scan);

    return reply.send({
      verdict: verdict.toLowerCase(),
      message: isMalicious ? "Threat Detected" : "Safe",
      logEntry: {
        id: scan.id,
        domain: scan.domain,
        verdict: scan.verdict.toLowerCase(),
        source: scan.source,
        checkedAt: scan.checkedAt.toISOString(),
      },
    });
  });

  app.post("/api/phishing/clear", async (request, reply) => {
    // TODO: delete from MongoDB
    phishingLog.length = 0;
    return reply.send({ success: true });
  });
}
