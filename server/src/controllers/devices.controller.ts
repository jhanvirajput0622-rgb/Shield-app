import { Request, Response } from "express";
import { Device } from "../models/Device";
import { ApiError } from "../utils/ApiError";

/** Shape a device document into the API response object */
function deviceView(doc: any) {
  return {
    id: doc._id.toString(),
    deviceName: doc.deviceName,
    platform: doc.platform,
    osVersion: doc.osVersion,
    appVersion: doc.appVersion,
    deviceModel: doc.deviceModel,
    deviceKeyFingerprint: doc.deviceKeyFingerprint,
    status: doc.status,
    isOnline: doc.isOnline,
    batteryPercent: doc.batteryPercent,
    lastSeenAt: doc.lastSeenAt.toISOString(),
    vpnEnabled: doc.vpnEnabled,
    theftProtectionEnabled: doc.theftProtectionEnabled,
    locationAvailable: doc.locationAvailable,
    latitude: doc.latitude,
    longitude: doc.longitude,
    locationLabel: doc.locationLabel,
    simStatus: doc.simStatus,
    gpsPrecision: doc.gpsPrecision,
    networkEncryption: doc.networkEncryption,
    pendingAction: doc.pendingAction,
    actionStatus: doc.actionStatus,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const devicesController = {
  // ── GET /api/devices ─────────────────────────────────────────────────────
  async listDevices(req: Request, res: Response): Promise<void> {
    const devices = await Device.find({ userId: req.userId }).sort({ lastSeenAt: -1 });
    res.json({
      success: true,
      data: devices.map(deviceView),
    });
  },

  // ── POST /api/devices ────────────────────────────────────────────────────
  async registerDevice(req: Request, res: Response): Promise<void> {
    const {
      deviceName,
      platform = "iOS",
      osVersion = "",
      appVersion = "",
      deviceModel = "",
      deviceKeyFingerprint = "",
    } = req.body as {
      deviceName: string;
      platform?: string;
      osVersion?: string;
      appVersion?: string;
      deviceModel?: string;
      deviceKeyFingerprint?: string;
    };

    const device = await Device.create({
      userId: req.userId,
      deviceName,
      platform,
      osVersion,
      appVersion,
      deviceModel,
      deviceKeyFingerprint,
    });

    res.status(201).json({ success: true, data: deviceView(device) });
  },

  // ── GET /api/devices/:id ──────────────────────────────────────────────────
  async getDevice(req: Request, res: Response): Promise<void> {
    const device = await Device.findOne({
      _id: req.params.id,
      userId: req.userId,
    });
    if (!device) throw ApiError.notFound("Device");
    res.json({ success: true, data: deviceView(device) });
  },

  // ── DELETE /api/devices/:id ───────────────────────────────────────────────
  async deleteDevice(req: Request, res: Response): Promise<void> {
    const result = await Device.deleteOne({
      _id: req.params.id,
      userId: req.userId,
    });
    if (result.deletedCount === 0) throw ApiError.notFound("Device");
    res.json({ success: true, message: "Device removed" });
  },
};
