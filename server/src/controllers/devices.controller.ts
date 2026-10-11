import { Request, Response } from "express";
import { Device } from "../models/Device";
import { ApiError } from "../utils/ApiError";
import { isoOrNull } from "../utils/date";

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
    // Optional: absent until the device first reports in. `isoOrNull` keeps this
    // a 200 instead of the 500 an unconditional `.toISOString()` produced.
    lastSeenAt: isoOrNull(doc.lastSeenAt),
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
    createdAt: isoOrNull(doc.createdAt),
    updatedAt: isoOrNull(doc.updatedAt),
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
      // Registering *is* the device reporting in, and `lastSeenAt` is the sort
      // key for every device list endpoint. Leaving it unset made that ordering
      // meaningless (Firestore sorts absent values first) and the response
      // carried `lastSeenAt: null`.
      lastSeenAt: new Date(),
    });

    res.status(201).json({ success: true, data: deviceView(device) });
  },

  async registerPushToken(req: Request, res: Response): Promise<void> {
    const { token, platform } = req.body as { token: string; platform: string };
    const currentDevice = await Device.findOne({ userId: req.userId }).sort({ lastSeenAt: -1 });

    if (currentDevice) {
      await Device.findOneAndUpdate(
        { _id: currentDevice._id, userId: req.userId },
        { $set: { pushToken: token, pushTokenUpdatedAt: new Date(), platform } },
        { new: true }
      );
    } else {
      await Device.create({
        userId: req.userId,
        deviceName: "Shield Mobile",
        platform,
        status: "online",
        lastSeenAt: new Date(),
        pushToken: token,
        pushTokenUpdatedAt: new Date(),
      });
    }

    res.status(200).json({ success: true });
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
