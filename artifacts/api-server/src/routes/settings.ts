import { FastifyInstance } from "fastify";

export default async function settingsRoutes(app: FastifyInstance) {
  app.get("/api/settings", async (request, reply) => {
    const response = {
      webProtectionEnabled: true,
      vpnAutoConnect: false,
      killSwitchEnabled: false,
      notifyHighRiskApps: true,
      notifyPhishingThreats: true,
      notifyDeviceUnlock: false,
      twoFactorEnabled: true,
      accountEmail: "demo@shield.app",
      linkedDeviceCount: 1,
    };
    return reply.send(response);
  });

  app.put("/api/settings", async (request, reply) => {
    const body = request.body as any;
    
    // Echo back merged mock state
    const response = {
      webProtectionEnabled: body.webProtectionEnabled ?? true,
      vpnAutoConnect: body.vpnAutoConnect ?? false,
      killSwitchEnabled: body.killSwitchEnabled ?? false,
      notifyHighRiskApps: body.notifyHighRiskApps ?? true,
      notifyPhishingThreats: body.notifyPhishingThreats ?? true,
      notifyDeviceUnlock: body.notifyDeviceUnlock ?? false,
      twoFactorEnabled: true,
      accountEmail: "demo@shield.app",
      linkedDeviceCount: 1,
    };
    return reply.send(response);
  });
}
