import { FastifyInstance } from "fastify";

export default async function dashboardRoutes(app: FastifyInstance) {
  app.get("/api/protection", async (request, reply) => {
    // TODO: Replace with MongoDB-backed aggregation
    const response = {
      overall: "action_needed",
      score: 75,
      permissionsStatus: "warning",
      networkStatus: "safe",
      phishingStatus: "safe",
      antitheftStatus: "safe",
      lastScanAt: new Date().toISOString(),
      threatsBlocked: 5,
      appsScanned: 10,
      linksScanned: 15,
    };

    return reply.send(response);
  });
}
