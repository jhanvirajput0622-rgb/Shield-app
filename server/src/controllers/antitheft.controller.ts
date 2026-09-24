import { Request, Response } from "express";
import { deviceService } from "../services/device.service";
import { securityEventService } from "../services/securityEvent.service";
import { auditService } from "../services/audit.service";
import {
  LockDeviceBody,
  WipeDeviceBody,
  RegisterDeviceBody,
} from "../validators/antitheft.validator";

/** Serialize a Device document into the shape the mobile client expects */
function deviceToResponse(device: Awaited<ReturnType<typeof deviceService.getPrimaryDevice>>) {
  if (!device) return null;
  return {
    deviceName: device.deviceName,
    status: device.status,
    batteryPercent: device.batteryPercent,
    lastSeenAt: device.lastSeenAt.toISOString(),
    locationAvailable: device.locationAvailable,
    latitude: device.latitude,
    longitude: device.longitude,
    locationLabel: device.locationLabel,
    simStatus: device.simStatus,
    gpsPrecision: device.gpsPrecision,
    networkEncryption: device.networkEncryption,
    pendingAction: device.pendingAction,
    actionStatus: device.actionStatus,
  };
}

export const antitheftController = {
  async registerDevice(req: Request, res: Response): Promise<void> {
    const body = req.body as RegisterDeviceBody;
    const device = await deviceService.registerDevice(req.userId, {
      deviceName: body.deviceName,
      platform: body.platform ?? "iOS",
      osVersion: body.osVersion ?? "",
      appVersion: body.appVersion ?? "",
      model: body.model ?? "",
      publicKey: body.publicKey ?? "",
    });
    res.status(201).json({ success: true, data: deviceToResponse(device) });
  },

  async getDeviceStatus(req: Request, res: Response): Promise<void> {
    const device = await deviceService.getPrimaryDevice(req.userId);
    if (!device) {
      // First-time access — return a default shell
      res.json({
        deviceName: "Shield Mobile",
        status: "offline",
        batteryPercent: 0,
        lastSeenAt: new Date().toISOString(),
        locationAvailable: false,
        latitude: null,
        longitude: null,
        locationLabel: "",
        simStatus: "Unknown",
        gpsPrecision: "Unknown",
        networkEncryption: "Unknown",
        pendingAction: "none",
        actionStatus: "idle",
      });
      return;
    }
    res.json(deviceToResponse(device));
  },

  async locateDevice(req: Request, res: Response): Promise<void> {
    const device = await deviceService.getPrimaryDevice(req.userId);
    if (!device) {
      res.json({
        deviceName: "Shield Mobile",
        status: "offline",
        batteryPercent: 0,
        lastSeenAt: new Date().toISOString(),
        locationAvailable: false,
        latitude: null,
        longitude: null,
        pendingAction: "none",
        actionStatus: "completed",
      });
      return;
    }

    // If client pushed real GPS coords, store them
    const { latitude, longitude, accuracy } = req.body ?? {};
    if (typeof latitude === "number" && typeof longitude === "number") {
      const updated = await deviceService.updateLocation(
        device._id,
        req.userId,
        latitude,
        longitude,
        accuracy ?? null
      );
      res.json(deviceToResponse(updated));
      return;
    }

    // If no GPS coords provided, return current device status (no command queued)
    res.json(deviceToResponse(device));
  },

  async lockDevice(req: Request, res: Response): Promise<void> {
    const { message } = req.body as LockDeviceBody;
    const device = await deviceService.getPrimaryDevice(req.userId);
    if (!device) {
      res.json({ success: true, status: "queued", message: "Lock command sent" });
      return;
    }

    await deviceService.queueLock(device._id, req.userId, message);
    await securityEventService.emit(
      req.userId,
      device._id,
      "remote_lock_queued",
      "medium",
      "Remote Lock Command Queued",
      `Lock message: "${message}"`,
      false
    );

    auditService.log(req.userId, "LOCK_DEVICE", `Remote lock queued for device: ${device.deviceName}`, {
      deviceId: device._id,
    }).catch(() => {});

    res.json({ success: true, status: "queued", message: "Lock command sent" });
  },

  async wipeDevice(req: Request, res: Response): Promise<void> {
    const { confirmationPhrase } = req.body as WipeDeviceBody;
    const device = await deviceService.getPrimaryDevice(req.userId);
    if (!device) {
      res.json({ success: true, status: "queued", message: "Wipe command sent" });
      return;
    }

    await deviceService.queueWipe(
      device._id,
      req.userId,
      confirmationPhrase,
      device.deviceName
    );
    await securityEventService.emit(
      req.userId,
      device._id,
      "remote_wipe_queued",
      "critical",
      "Remote Wipe Command Queued",
      "Device wipe has been authorised and queued",
      false
    );

    auditService.log(req.userId, "WIPE_DEVICE", `Remote wipe queued for device: ${device.deviceName}`, {
      deviceId: device._id,
    }).catch(() => {});

    res.json({ success: true, status: "queued", message: "Wipe command sent" });
  },
};
