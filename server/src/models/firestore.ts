import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { FirestoreDocument, createFirestoreModel } from "../services/firestoreMigration";

export type ModelId = string;
export type DeviceStatus = "online" | "offline" | "lost" | "locked" | "wiped";
export type PendingAction = "none" | "locate" | "lock" | "wipe";
export type ActionStatus = "idle" | "queued" | "delivered" | "completed" | "failed";
export type EventSeverity = "info" | "low" | "medium" | "high" | "critical";
export type PhishingVerdict = "safe" | "malicious" | "unknown" | "suspicious";
export type PhishingSource = "manual_check" | "auto_scan" | "sms" | "qr";
export type NotificationType = "Alert" | "Info" | "Warning";
export type WifiSecurityType = string;
export type AuditAction = string;
export type ThreatType = string;
export type ThreatSeverity = "Low" | "Medium" | "High" | "Critical";

export interface FirestoreModelDocument extends FirestoreDocument {
  [key: string]: any;
}

export interface IUser extends FirestoreModelDocument {
  email: string;
  passwordHash: string;
  displayName: string;
  name: string;
  phoneNumber: string | null;
  googleSub: string | null;
  role: "user" | "admin";
  protectionScore: number;
  isActive: boolean;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  lastLoginAt: Date | null;
  comparePassword(candidate: string): Promise<boolean>;
}
export interface IDevice extends FirestoreModelDocument {}
export interface ISettings extends FirestoreModelDocument {}
export interface IRefreshToken extends FirestoreModelDocument {}
export interface IPasswordResetToken extends FirestoreModelDocument {}
export interface ISecurityEvent extends FirestoreModelDocument {}
export interface IPhishingCheck extends FirestoreModelDocument {}
export interface IThreat extends FirestoreModelDocument {}
export interface INotification extends FirestoreModelDocument {}
export interface IAuditLog extends FirestoreModelDocument {}
export interface IDeviceLocation extends FirestoreModelDocument {}
export interface ITheftCommand extends FirestoreModelDocument {}
export interface IAntiTheftCommand extends FirestoreModelDocument {}
export interface IAntiTheftLog extends FirestoreModelDocument {}
export interface IPermissionScan extends FirestoreModelDocument {}
export interface IAppPermission extends FirestoreModelDocument {}
export interface IInstalledApp extends FirestoreModelDocument {}
export interface IAppFinding {
  appName: string;
  packageName: string;
  category: string;
  requestedPermissions: string[];
  riskScore: number;
  riskLevel: "safe" | "low" | "medium" | "high" | "critical";
  riskReasons: string[];
}
export interface IAppPermissionScan extends FirestoreModelDocument {
  apps: IAppFinding[];
  totalApps: number;
  highRiskCount: number;
  scannedAt: Date;
}
export interface ICompanionAccount extends FirestoreModelDocument {}
export interface ICompanionSession extends FirestoreModelDocument {}
export interface IVpnSession extends FirestoreModelDocument {}
export interface IWifiNetwork extends FirestoreModelDocument {}
export interface IUserKey extends FirestoreModelDocument {}
export interface IUserSetting extends FirestoreModelDocument {}
export interface IEmailOtpChallenge extends FirestoreModelDocument {}

export const User = Object.assign(createFirestoreModel<IUser>("users"), {
  hashPassword: (plain: string) => bcrypt.hash(plain, 12),
});
export const Device = createFirestoreModel<IDevice>("devices");
export const Settings = createFirestoreModel<ISettings>("settings");
export const RefreshToken = createFirestoreModel<IRefreshToken>("refreshTokens");
export const PasswordResetToken = createFirestoreModel<IPasswordResetToken>("passwordResetTokens");
export const EmailOtpChallenge = createFirestoreModel<IEmailOtpChallenge>("emailOtpChallenges");
export const SecurityEvent = createFirestoreModel<ISecurityEvent>("securityEvents");
export const PhishingCheck = createFirestoreModel<IPhishingCheck>("phishingChecks");
export const Threat = createFirestoreModel<IThreat>("threats");
export const Notification = createFirestoreModel<INotification>("notifications");
export const AuditLog = createFirestoreModel<IAuditLog>("auditLogs");
export const DeviceLocation = createFirestoreModel<IDeviceLocation>("deviceLocations");
export const TheftCommand = createFirestoreModel<ITheftCommand>("theftCommands");
export const AntiTheftCommand = createFirestoreModel<IAntiTheftCommand>("antiTheftCommands");
export const AntiTheftLog = createFirestoreModel<IAntiTheftLog>("antiTheftLogs");
export const PermissionScan = createFirestoreModel<IPermissionScan>("permissionScans");
export const AppPermission = createFirestoreModel<IAppPermission>("appPermissions");
export const InstalledApp = createFirestoreModel<IInstalledApp>("installedApps");
export const AppPermissionScan = createFirestoreModel<IAppPermissionScan>("appPermissionScans");
export const CompanionAccount = createFirestoreModel<ICompanionAccount>("companionAccounts");
export const CompanionSession = createFirestoreModel<ICompanionSession>("companionSessions");
export const VpnSession = createFirestoreModel<IVpnSession>("vpnSessions");
export const WifiNetwork = createFirestoreModel<IWifiNetwork>("wifiNetworks");
export const UserKey = createFirestoreModel<IUserKey>("userKeys");
export const UserSetting = createFirestoreModel<IUserSetting>("userSettings");

export function hashRefreshToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}
export function generateRawToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
export function hashResetToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
