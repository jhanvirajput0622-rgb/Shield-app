import { Settings, ISettings } from "../models/Settings";
import { User } from "../models/User";
import { Device } from "../models/Device";

export interface FullSettings {
  webProtectionEnabled: boolean;
  vpnAutoConnect: boolean;
  killSwitchEnabled: boolean;
  notifyHighRiskApps: boolean;
  notifyPhishingThreats: boolean;
  notifyDeviceUnlock: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  accountEmail: string;
  linkedDeviceCount: number;
}

export class SettingsService {
  /** Upsert: create settings row if it doesn't exist yet */
  private async getOrCreate(userId: string): Promise<ISettings> {
    let settings = await Settings.findOne({ userId });
    if (!settings) {
      settings = await Settings.create({ userId });
    }
    return settings;
  }

  async getSettings(userId: string): Promise<FullSettings> {
    const [settings, user, linkedDeviceCount] = await Promise.all([
      this.getOrCreate(userId),
      User.findById(userId).select("email twoFactorEnabled lastLoginAt"),
      Device.countDocuments({ userId }),
    ]);

    return {
      webProtectionEnabled: settings.webProtectionEnabled,
      vpnAutoConnect: settings.vpnAutoConnect,
      killSwitchEnabled: settings.killSwitchEnabled,
      notifyHighRiskApps: settings.notifyHighRiskApps,
      notifyPhishingThreats: settings.notifyPhishingThreats,
      notifyDeviceUnlock: settings.notifyDeviceUnlock,
      twoFactorEnabled: user?.twoFactorEnabled ?? false,
      lastLoginAt: user?.lastLoginAt?.toISOString() ?? null,
      accountEmail: user?.email ?? "",
      linkedDeviceCount,
    };
  }

  async updateSettings(
    userId: string,
    patch: Partial<Pick<
      ISettings,
      | "webProtectionEnabled"
      | "vpnAutoConnect"
      | "killSwitchEnabled"
      | "notifyHighRiskApps"
      | "notifyPhishingThreats"
      | "notifyDeviceUnlock"
    >>
  ): Promise<FullSettings> {
    await Settings.findOneAndUpdate(
      { userId },
      { $set: patch },
      { upsert: true, new: true }
    );
    return this.getSettings(userId);
  }
}

export const settingsService = new SettingsService();
