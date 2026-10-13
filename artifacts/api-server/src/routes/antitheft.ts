import { FastifyInstance } from "fastify";

export default async function antitheftRoutes(app: FastifyInstance) {
  app.get("/api/device/status", async (request, reply) => {
    // TODO: fetch from MongoDB
    const response = {
      deviceName: "Shield Test Device",
      status: "online",
      batteryPercent: 80,
      lastSeenAt: new Date().toISOString(),
      locationAvailable: true,
      latitude: 40.7128,
      longitude: -74.006,
      locationLabel: "New York, NY",
      simStatus: "Active",
      gpsPrecision: "±5m",
      networkEncryption: "WPA3",
      pendingAction: "none",
      actionStatus: "idle",
    };
    return reply.send(response);
  });

  app.post("/api/device/locate", async (request, reply) => {
    // TODO: poll location from MongoDB
    const response = {
      deviceName: "Shield Test Device",
      status: "online",
      batteryPercent: 80,
      lastSeenAt: new Date().toISOString(),
      locationAvailable: true,
      latitude: 40.7128,
      longitude: -74.006,
      pendingAction: "none",
      actionStatus: "completed",
    };
    return reply.send(response);
  });

  app.post("/api/device/lock", async (request, reply) => {
    const body = request.body as any;
    // TODO: insert lock command into MongoDB command queue
    return reply.send({ success: true, status: "queued", message: "Lock command sent" });
  });

  app.post("/api/device/wipe", async (request, reply) => {
    const body = request.body as any;
    // TODO: insert wipe command into MongoDB command queue
    return reply.send({ success: true, status: "queued", message: "Wipe command sent" });
  });
}
