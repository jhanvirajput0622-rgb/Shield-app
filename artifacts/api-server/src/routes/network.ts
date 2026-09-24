import { FastifyInstance } from "fastify";

export default async function networkRoutes(app: FastifyInstance) {
  app.get("/api/network/status", async (request, reply) => {
    // TODO: fetch from MongoDB
    const response = {
      ssid: "Shield_Guest",
      isSecured: false,
      signalStrength: -65,
      speedMbps: 25.5,
      riskLevel: "warning",
      vpnConnected: false,
    };
    return reply.send(response);
  });

  app.post("/api/network/vpn/connect", async (request, reply) => {
    // TODO: persist VPN session to MongoDB
    const response = {
      connected: true,
      localIp: "10.8.0.2",
      protocol: "WireGuard",
      serverLocation: "US East",
      encryption: "ChaCha20",
      connectedAt: new Date().toISOString(),
    };
    return reply.send(response);
  });

  app.post("/api/network/vpn/disconnect", async (request, reply) => {
    // TODO: update VPN session in MongoDB
    const response = { success: true };
    return reply.send(response);
  });
}
