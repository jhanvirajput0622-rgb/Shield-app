import { Device, IDevice } from "../models/Device";
import { ApiError } from "../utils/ApiError";

export interface RegisterDeviceInput {
  deviceName: string;
  platform: string;
  osVersion: string;
  appVersion: string;
  model: string; // passed-in field name; stored as deviceModel in Device doc
  publicKey: string;
}

export class DeviceService {
  /** Get the primary device for a user (first registered / most recently seen) */
  async getPrimaryDevice(userId: string): Promise<IDevice | null> {
    return Device.findOne({ userId }).sort({ lastSeenAt: -1 });
  }

  /** Get by ID, enforcing ownership */
  async getDeviceById(
    deviceId: string,
    userId: string
  ): Promise<IDevice> {
    const device = await Device.findOne({ _id: deviceId, userId });
    if (!device) throw ApiError.notFound("Device");
    return device;
  }

  /** Register a new device for a user */
  async registerDevice(
    userId: string,
    input: RegisterDeviceInput
  ): Promise<IDevice> {
    return Device.create({
      userId,
      deviceName: input.deviceName,
      platform: input.platform,
      osVersion: input.osVersion,
      appVersion: input.appVersion,
      deviceModel: input.model,
      publicKey: input.publicKey,
    });
  }

  /** Touch lastSeenAt and optionally update battery */
  async heartbeat(
    deviceId: string,
    userId: string,
    batteryPercent?: number
  ): Promise<IDevice> {
    const update: Partial<IDevice> = { lastSeenAt: new Date() };
    if (batteryPercent !== undefined) update.batteryPercent = batteryPercent;

    const device = await Device.findOneAndUpdate(
      { _id: deviceId, userId },
      { $set: update },
      { new: true }
    );
    if (!device) throw ApiError.notFound("Device");
    return device;
  }

  /** Store GPS coordinates pushed from the device */
  async updateLocation(
    deviceId: string,
    userId: string,
    latitude: number,
    longitude: number,
    accuracy: number | null,
    label = ""
  ): Promise<IDevice> {
    const device = await Device.findOneAndUpdate(
      { _id: deviceId, userId },
      {
        $set: {
          locationAvailable: true,
          latitude,
          longitude,
          locationLabel: label,
          locationAccuracy: accuracy,
          locationUpdatedAt: new Date(),
          lastSeenAt: new Date(),
          pendingAction: "none",
          actionStatus: "completed",
        },
      },
      { new: true }
    );
    if (!device) throw ApiError.notFound("Device");
    return device;
  }

  /** Queue a remote lock command */
  async queueLock(
    deviceId: string,
    userId: string,
    message: string
  ): Promise<IDevice> {
    const device = await Device.findOneAndUpdate(
      { _id: deviceId, userId },
      {
        $set: {
          pendingAction: "lock",
          actionStatus: "queued",
          lockMessage: message,
        },
      },
      { new: true }
    );
    if (!device) throw ApiError.notFound("Device");
    return device;
  }

  /** Queue a remote wipe command — enforces confirmation phrase */
  async queueWipe(
    deviceId: string,
    userId: string,
    confirmationPhrase: string,
    deviceName: string
  ): Promise<IDevice> {
    if (confirmationPhrase !== deviceName) {
      throw ApiError.badRequest(
        `Confirmation phrase must exactly match the device name: "${deviceName}"`
      );
    }

    const device = await Device.findOneAndUpdate(
      { _id: deviceId, userId },
      { $set: { pendingAction: "wipe", actionStatus: "queued", status: "lost" } },
      { new: true }
    );
    if (!device) throw ApiError.notFound("Device");
    return device;
  }
}

export const deviceService = new DeviceService();
