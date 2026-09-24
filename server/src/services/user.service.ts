import bcrypt from "bcryptjs";
import crypto from "crypto";
import mongoose from "mongoose";
import { OAuth2Client } from "google-auth-library";
import { User, IUser } from "../models/User";
import { Settings } from "../models/Settings";
import { Device } from "../models/Device";
import { RefreshToken, generateRawToken, hashRefreshToken } from "../models/RefreshToken";
import { PasswordResetToken, generateResetToken, hashResetToken } from "../models/PasswordResetToken";
import { ApiError } from "../utils/ApiError";
import { signAccessToken } from "../middleware/auth.middleware";
import { logger } from "../utils/logger";
import { authenticator } from "otplib";
import qrcode from "qrcode";

// ─── Duration helpers ─────────────────────────────────────────────────────────

function parseExpiryMs(envVar: string, fallbackDays: number): number {
  const raw = process.env[envVar] ?? "";
  const match = raw.match(/^(\d+)([dDhHmM]?)$/);
  if (!match) return fallbackDays * 24 * 60 * 60 * 1000;
  const n = Number(match[1]);
  switch ((match[2] ?? "d").toLowerCase()) {
    case "h": return n * 60 * 60 * 1000;
    case "m": return n * 60 * 1000;
    default:  return n * 24 * 60 * 60 * 1000;
  }
}

// ─── Shared response shape ────────────────────────────────────────────────────

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    twoFactorEnabled: boolean;
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class UserService {
  /** Issue a new refresh token and persist its hash */
  private async issueRefreshToken(
    userId: mongoose.Types.ObjectId,
    deviceId?: mongoose.Types.ObjectId | null
  ): Promise<string> {
    const raw = generateRawToken();
    const expiresAt = new Date(
      Date.now() + parseExpiryMs("JWT_REFRESH_EXPIRES_IN", 30)
    );
    await RefreshToken.create({
      userId,
      deviceId: deviceId ?? null,
      tokenHash: hashRefreshToken(raw),
      expiresAt,
    });
    return raw;
  }

  /** Register a new user and seed default settings */
  async register(
    email: string,
    password: string,
    displayName?: string,
    name?: string,
    phoneNumber?: string
  ): Promise<AuthResult> {
    const existing = await User.findOne({ email });
    if (existing) {
      throw ApiError.conflict("An account with that email already exists");
    }

    // Check phone uniqueness when provided
    if (phoneNumber) {
      const phoneExists = await User.findOne({ phoneNumber });
      if (phoneExists) {
        throw ApiError.conflict("An account with that phone number already exists");
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const resolvedName = name ?? displayName ?? email.split("@")[0];
    const user = await User.create({
      email,
      passwordHash,
      displayName: resolvedName,
      name: resolvedName,
      phoneNumber: phoneNumber || null,
    });

    // Seed default settings for the new user
    await Settings.create({ userId: user._id });

    const accessToken = signAccessToken(user._id.toString(), user.email);
    const refreshToken = await this.issueRefreshToken(user._id);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id.toString(),
        email: user.email,
        displayName: user.displayName,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    };
  }

  /** Login — returns both access + refresh tokens */
  async login(email: string, password: string, otp?: string): Promise<AuthResult> {
    // Need passwordHash — it's select:false on the schema
    const user = await User.findOne({ email }).select("+passwordHash +twoFactorSecret");
    if (!user) {
      // Constant-time response to prevent user enumeration
      await bcrypt.compare(password, "$2b$12$invalidhashfortimingprotection00");
      throw ApiError.unauthorized("Invalid email or password");
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      throw ApiError.unauthorized("Invalid email or password");
    }

    // 2FA Check
    if (user.twoFactorEnabled) {
      if (!otp) {
        throw new ApiError(401, "MFA_REQUIRED");
      }
      if (!user.twoFactorSecret) {
        throw ApiError.internal("2FA is enabled but secret is missing");
      }
      const isValidOtp = authenticator.verify({ token: otp, secret: user.twoFactorSecret });
      if (!isValidOtp) {
        throw ApiError.unauthorized("Invalid authentication code");
      }
    }

    user.lastLoginAt = new Date();
    await user.save();

    const accessToken = signAccessToken(user._id.toString(), user.email);
    const refreshToken = await this.issueRefreshToken(user._id);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id.toString(),
        email: user.email,
        displayName: user.displayName,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    };
  }

  /**
   * Google OAuth sign-in / sign-up.
   *
   * Verifies the Google ID token, then either logs in an existing user
   * (matched by googleSub, falling back to verified email) or auto-registers
   * a new account seeded from Google's profile.
   */
  async googleSignIn(
    idToken: string
  ): Promise<AuthResult & { isNewUser: boolean }> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      logger.error("GOOGLE_CLIENT_ID is not configured");
      throw ApiError.internal("Google sign-in is not configured");
    }

    let payload: {
      sub: string;
      email?: string;
      name?: string;
      email_verified?: boolean;
      picture?: string;
    } | null = null;
    try {
      const client = new OAuth2Client(clientId);
      const ticket = await client.verifyIdToken({ idToken, audience: clientId });
      const verifiedPayload = ticket.getPayload();
      if (verifiedPayload && verifiedPayload.sub) {
        payload = verifiedPayload;
      }
    } catch {
      throw ApiError.unauthorized("Invalid Google sign-in token");
    }

    if (!payload) {
      throw ApiError.unauthorized("Invalid Google sign-in token");
    }

    const googleSub = payload.sub;
    const email = payload.email?.toLowerCase().trim();
    if (!email) {
      throw ApiError.badRequest("Google account has no email address");
    }
    if (payload.email_verified !== true) {
      throw ApiError.unauthorized("Google email is not verified");
    }

    let user: IUser | null = await User.findOne({ googleSub }).select("+passwordHash");
    if (!user) {
      // Match by verified email so an existing email/password account can sign
      // in with Google without creating a duplicate.
      user = await User.findOne({ email }).select("+passwordHash");
      if (user && !user.googleSub) {
        user.googleSub = googleSub;
        await user.save();
      }
    }

    let isNewUser = false;
    if (!user) {
      // Auto-register a new account from the Google profile.
      const displayName = payload.name?.trim() || email.split("@")[0];
      const randomPassword = crypto.randomBytes(32).toString("hex");
      const passwordHash = await bcrypt.hash(randomPassword, 12);
      user = await User.create({
        email,
        passwordHash,
        displayName,
        name: displayName,
        googleSub,
      });
      await Settings.create({ userId: user._id });
      isNewUser = true;
      logger.info(`New Google account registered: ${email}`);
    }

    user.lastLoginAt = new Date();
    await user.save();

    const accessToken = signAccessToken(user._id.toString(), user.email);
    const refreshToken = await this.issueRefreshToken(user._id);

    return {
      accessToken,
      refreshToken,
      isNewUser,
      user: {
        id: user._id.toString(),
        email: user.email,
        displayName: user.displayName,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    };
  }

  /**
   * Refresh token rotation:
   *   1. Look up the hashed token.
   *   2. Verify it is not revoked / expired.
   *   3. Revoke it (one-time use).
   *   4. Issue a new access token + new refresh token.
   *
   * If a token is found but already revoked, ALL tokens for that user are
   * invalidated (possible token-theft scenario).
   */
  async refreshTokens(rawToken: string): Promise<AuthResult> {
    const tokenHash = hashRefreshToken(rawToken);
    const stored = await RefreshToken.findOne({ tokenHash });

    if (!stored) {
      throw ApiError.unauthorized("Invalid refresh token");
    }

    if (stored.revoked) {
      // Possible replay / token theft — revoke all sessions for safety
      logger.warn(
        `Revoked refresh token reuse detected for userId: ${stored.userId}`
      );
      await RefreshToken.updateMany(
        { userId: stored.userId },
        { $set: { revoked: true } }
      );
      throw ApiError.unauthorized(
        "Refresh token already used. All sessions revoked for security."
      );
    }

    if (stored.expiresAt < new Date()) {
      await RefreshToken.updateOne({ _id: stored._id }, { $set: { revoked: true } });
      throw ApiError.unauthorized("Refresh token has expired");
    }

    // Revoke the used token (rotation)
    await RefreshToken.updateOne({ _id: stored._id }, { $set: { revoked: true } });

    const user = await User.findById(stored.userId);
    if (!user) throw ApiError.unauthorized("User not found");

    const accessToken = signAccessToken(user._id.toString(), user.email);
    const newRefreshToken = await this.issueRefreshToken(
      user._id,
      stored.deviceId as mongoose.Types.ObjectId | null
    );

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user._id.toString(),
        email: user.email,
        displayName: user.displayName,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    };
  }

  /** Logout — revoke the specific refresh token provided */
  async logout(rawToken: string): Promise<void> {
    const tokenHash = hashRefreshToken(rawToken);
    await RefreshToken.updateOne({ tokenHash }, { $set: { revoked: true } });
  }

  /** Logout from all devices — revoke every refresh token for a user */
  async logoutAll(userId: mongoose.Types.ObjectId): Promise<void> {
    await RefreshToken.updateMany(
      { userId, revoked: false },
      { $set: { revoked: true } }
    );
  }

  async getUserById(userId: mongoose.Types.ObjectId): Promise<IUser> {
    const user = await User.findById(userId);
    if (!user) throw ApiError.notFound("User");
    return user;
  }

  /** Count linked devices for settings display */
  async countDevices(userId: mongoose.Types.ObjectId): Promise<number> {
    return Device.countDocuments({ userId });
  }

  /**
   * Generates a reset token and simulates emailing it to the user.
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await User.findOne({ email });
    if (!user) {
      // Do not reveal if the email is registered
      logger.info(`Forgot password requested for non-existent email: ${email}`);
      return;
    }

    const rawToken = generateResetToken();
    const tokenHash = hashResetToken(rawToken);
    
    // Expires in 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await PasswordResetToken.create({
      userId: user._id,
      tokenHash,
      expiresAt,
    });

    // Simulate sending email by logging the token
    logger.info(`[SIMULATED EMAIL] Password reset token for ${email}: ${rawToken}`);
  }

  /**
   * Validates the reset token and updates the user's password.
   */
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = hashResetToken(rawToken);
    const stored = await PasswordResetToken.findOne({ tokenHash });

    if (!stored) {
      throw ApiError.badRequest("Invalid or expired reset token");
    }

    if (stored.used) {
      throw ApiError.badRequest("Reset token has already been used");
    }

    if (stored.expiresAt < new Date()) {
      throw ApiError.badRequest("Reset token has expired");
    }

    const user = await User.findById(stored.userId);
    if (!user) {
      throw ApiError.notFound("User not found");
    }

    // Update password
    const passwordHash = await bcrypt.hash(newPassword, 12);
    user.passwordHash = passwordHash;
    await user.save();

    // Mark token as used
    stored.used = true;
    await stored.save();

    // Revoke all existing sessions for security
    await this.logoutAll(user._id);
  }

  /**
   * Generates a new 2FA secret and returns the QR code data URI.
   * Does NOT enable 2FA until it's verified.
   */
  async setup2FA(userId: mongoose.Types.ObjectId): Promise<{ secret: string; qrCode: string }> {
    const user = await User.findById(userId);
    if (!user) throw ApiError.notFound("User not found");

    if (user.twoFactorEnabled) {
      throw ApiError.badRequest("Two-factor authentication is already enabled");
    }

    const secret = authenticator.generateSecret();
    user.twoFactorSecret = secret;
    await user.save();

    const otpauth = authenticator.keyuri(user.email, "Shield", secret);
    const qrCode = await qrcode.toDataURL(otpauth);

    return { secret, qrCode };
  }

  /**
   * Verifies the provided OTP against the saved secret and enables 2FA.
   */
  async verify2FA(userId: mongoose.Types.ObjectId, otp: string): Promise<void> {
    const user = await User.findById(userId).select("+twoFactorSecret");
    if (!user) throw ApiError.notFound("User not found");

    if (user.twoFactorEnabled) {
      throw ApiError.badRequest("Two-factor authentication is already enabled");
    }

    if (!user.twoFactorSecret) {
      throw ApiError.badRequest("2FA setup not initialized");
    }

    const isValid = authenticator.verify({ token: otp, secret: user.twoFactorSecret });
    if (!isValid) {
      throw ApiError.unauthorized("Invalid authentication code");
    }

    user.twoFactorEnabled = true;
    await user.save();
  }

  /**
   * Disables 2FA (requires password verification).
   */
  async disable2FA(userId: mongoose.Types.ObjectId, password: string): Promise<void> {
    const user = await User.findById(userId).select("+passwordHash");
    if (!user) throw ApiError.notFound("User not found");

    if (!user.twoFactorEnabled) {
      throw ApiError.badRequest("Two-factor authentication is not enabled");
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      throw ApiError.unauthorized("Invalid password");
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    await user.save();
  }
}

export const userService = new UserService();
