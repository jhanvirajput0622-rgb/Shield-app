/**
 * TheftController — handles the spec-required /api/theft/* routes.
 *
 * Each action creates a TheftCommand record (lifecycle: pending → sent →
 * acknowledged → completed | failed | expired) and updates the Device document.
 *
 * SECURITY:
 *   - Every route checks that the authenticated user owns the target device.
 *   - Wipe requires a confirmationPhrase that matches the device name exactly.
 *   - Location history is stored in DeviceLocation (30-day TTL).
 */
import { Request, Response } from "express";
import mongoose from "mongoose";
import { Device } from "../models/Device";
import { TheftCommand } from "../models/TheftCommand";
import { DeviceLocation } from "../models/DeviceLocation";
import { securityEventService } from "../services/securityEvent.service";
import { ApiError } from "../utils/ApiError";
import { LockDeviceBody, WipeDeviceBody } from "../validators/antitheft.validator";

/** Find the primary device for the authed user, throw 404 if none */
async function requirePrimaryDevice(userId: mongoose.Types.ObjectId) {
  const device = await Device.findOne({ userId }).sort({ lastSeenAt: -1 });
  if (!device) throw ApiError.notFound("Device");
  return device;
}

export const theftController = {
  // ── POST /api/theft/locate ────────────────────────────────────────────────
  async locate(req: Request, res: Response): Promise<void> {
    const device = await requirePrimaryDevice(req.userId);

    // If the client pushed GPS coords, record them
    const { latitude, longitude, accuracy } = req.body ?? {};
    if (typeof latitude === "number" && typeof longitude === "number") {
      await DeviceLocation.create({
        deviceId: device._id,
        userId: req.userId,
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        recordedAt: new Date(),
      });

      const updated = await Device.findOneAndUpdate(
        { _id: device._id, userId: req.userId },
        {
          $set: {
            locationAvailable: true,
            latitude,
            longitude,
            locationAccuracy: accuracy ?? null,
            locationUpdatedAt: new Date(),
            pendingAction: "none",
            actionStatus: "completed",
          },
        },
        { new: true }
      );

      const cmd = await TheftCommand.create({
        userId: req.userId,
        deviceId: device._id,
        command: "locate",
        status: "completed",
        issuedAt: new Date(),
        completedAt: new Date(),
      });

      res.json({
        success: true,
        commandId: cmd._id.toString(),
        status: "completed",
        location: { latitude, longitude, accuracy: accuracy ?? null },
        device: updated ? { status: updated.status } : undefined,
      });
      return;
    }

    // Queue locate command (mobile will poll and push coords)
    await Device.findOneAndUpdate(
      { _id: device._id, userId: req.userId },
      { $set: { pendingAction: "locate", actionStatus: "queued" } }
    );

    const cmd = await TheftCommand.create({
      userId: req.userId,
      deviceId: device._id,
      command: "locate",
      status: "pending",
    });

    res.json({
      success: true,
      commandId: cmd._id.toString(),
      status: "pending",
      message: "Locate command queued — awaiting device response",
    });
  },

  // ── POST /api/theft/lock ──────────────────────────────────────────────────
  async lock(req: Request, res: Response): Promise<void> {
    const { message } = req.body as LockDeviceBody;
    const device = await requirePrimaryDevice(req.userId);

    await Device.findOneAndUpdate(
      { _id: device._id, userId: req.userId },
      {
        $set: {
          pendingAction: "lock",
          actionStatus: "queued",
          lockMessage: message,
          status: "locked",
        },
      }
    );

    const cmd = await TheftCommand.create({
      userId: req.userId,
      deviceId: device._id,
      command: "lock",
      message,
      status: "pending",
    });

    await securityEventService.emit(
      req.userId,
      device._id,
      "remote_lock_issued",
      "medium",
      "Remote Lock Command Issued",
      `Lock message: "${message}"`,
      false
    );

    res.json({
      success: true,
      commandId: cmd._id.toString(),
      status: "pending",
      message: "Lock command issued — pending delivery",
    });
  },

  // ── POST /api/theft/wipe ──────────────────────────────────────────────────
  async wipe(req: Request, res: Response): Promise<void> {
    const { confirmationPhrase } = req.body as WipeDeviceBody;
    const device = await requirePrimaryDevice(req.userId);

    // High-risk authorization: confirmation phrase must match device name exactly
    if (confirmationPhrase !== device.deviceName) {
      throw ApiError.badRequest(
        `Confirmation phrase must exactly match device name: "${device.deviceName}"`
      );
    }

    await Device.findOneAndUpdate(
      { _id: device._id, userId: req.userId },
      {
        $set: {
          pendingAction: "wipe",
          actionStatus: "queued",
          status: "lost",
        },
      }
    );

    const cmd = await TheftCommand.create({
      userId: req.userId,
      deviceId: device._id,
      command: "wipe",
      status: "pending",
    });

    await securityEventService.emit(
      req.userId,
      device._id,
      "remote_wipe_issued",
      "critical",
      "Remote Wipe Command Issued",
      "Device wipe authorised and queued",
      false
    );

    res.json({
      success: true,
      commandId: cmd._id.toString(),
      status: "pending",
      message:
        "Wipe command issued. This action cannot be undone. Awaiting device delivery.",
    });
  },

  // ── GET /api/theft/commands ───────────────────────────────────────────────
  async listCommands(req: Request, res: Response): Promise<void> {
    const device = await Device.findOne({ userId: req.userId }).sort({
      lastSeenAt: -1,
    });

    const filter = device
      ? { userId: req.userId, deviceId: device._id }
      : { userId: req.userId };

    const commands = await TheftCommand.find(filter)
      .sort({ issuedAt: -1 })
      .limit(20);

    res.json({
      success: true,
      data: commands.map((c) => ({
        id: c._id.toString(),
        command: c.command,
        message: c.message,
        status: c.status,
        issuedAt: c.issuedAt.toISOString(),
        acknowledgedAt: c.acknowledgedAt?.toISOString() ?? null,
        completedAt: c.completedAt?.toISOString() ?? null,
        expiresAt: c.expiresAt.toISOString(),
      })),
    });
  },

  // ── GET /api/theft/location/:deviceId ─────────────────────────────────────
  async getLocation(req: Request, res: Response): Promise<void> {
    const { deviceId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(deviceId)) {
      throw ApiError.badRequest("Invalid device id");
    }

    // Verify ownership
    const device = await Device.findOne({
      _id: deviceId,
      userId: req.userId,
    });
    if (!device) throw ApiError.notFound("Device");

    // Return most recent GPS fix stored for this device
    const locations = await DeviceLocation.find({ deviceId: device._id })
      .sort({ recordedAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        deviceId: device._id.toString(),
        deviceName: device.deviceName,
        locationAvailable: device.locationAvailable,
        current: device.locationAvailable
          ? {
              latitude: device.latitude,
              longitude: device.longitude,
              accuracy: device.locationAccuracy,
              recordedAt: device.locationUpdatedAt?.toISOString() ?? null,
            }
          : null,
        history: locations.map((l) => ({
          latitude: l.latitude,
          longitude: l.longitude,
          accuracy: l.accuracy,
          recordedAt: l.recordedAt.toISOString(),
        })),
      },
    });
  },
};
