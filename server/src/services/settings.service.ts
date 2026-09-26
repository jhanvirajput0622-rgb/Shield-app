import { Settings, ISettings } from "../models/Settings";
import { User } from "../models/User";
import { Device } from "../models/Device";
import { SETTINGS_DEFAULTS } from "../db/schema";
import { isoOrNull } from "../utils/date";

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
      settings = await Settings.create({ userId, ...SETTINGS_DEFAULTS });
    }
    return settings;
  }

  async getSettings(userId: string): Promise<FullSettings> {
    const [settings, user, linkedDeviceCount] = await Promise.all([
      this.getOrCreate(userId),
      User.findById(userId).select("email twoFactorEnabled lastLoginAt"),
      Device.countDocuments({ userId }),
    ]);

    // The `?? false` fallbacks are not redundant with SETTINGS_DEFAULTS: rows
    // created before that constant existed have none of these fields stored, and
    // returning `undefined` drops the key from the JSON entirely, violating the
    // `required` list on `ShieldSettings` in lib/api-spec/openapi.yaml.
    return {
      webProtectionEnabled: settings.webProtectionEnabled ?? false,
      vpnAutoConnect: settings.vpnAutoConnect ?? false,
      killSwitchEnabled: settings.killSwitchEnabled ?? false,
      notifyHighRiskApps: settings.notifyHighRiskApps ?? false,
      notifyPhishingThreats: settings.notifyPhishingThreats ?? false,
      notifyDeviceUnlock: settings.notifyDeviceUnlock ?? false,
      twoFactorEnabled: user?.twoFactorEnabled ?? false,
      lastLoginAt: isoOrNull(user?.lastLoginAt),
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
