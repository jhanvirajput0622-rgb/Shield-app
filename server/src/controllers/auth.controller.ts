import { Request, Response } from "express";
import { userService } from "../services/user.service";
import { auditService } from "../services/audit.service";
import { RegisterBody, LoginBody, GoogleAuthBody, RequestEmailOtpBody, VerifyEmailOtpBody, RefreshBody, LogoutBody, ForgotPasswordBody, ResetPasswordBody, Verify2FABody, Disable2FABody } from "../validators/auth.validator";

function ipOf(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    ""
  );
}

export const authController = {
  // ── POST /api/auth/register ──────────────────────────────────────────────
  async register(req: Request, res: Response): Promise<void> {
    const { email, password, displayName, name, phoneNumber } = req.body as RegisterBody;
    const result = await userService.register(email, password, displayName, name, phoneNumber);

    // Fire-and-forget audit log
    auditService.log(
      result.user.id,
      "REGISTER",
      `New account registered: ${email}`,
      { ipAddress: ipOf(req), userAgent: req.headers["user-agent"] ?? "" }
    ).catch(() => {/* non-critical */});

    res.status(201).json({
      success: true,
      data: {
        token: result.accessToken,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      },
    });
  },

  // ── POST /api/auth/login ─────────────────────────────────────────────────
  async login(req: Request, res: Response): Promise<void> {
    const { email, password, otp } = req.body as LoginBody;
    const result = await userService.login(email, password, otp);

    auditService.log(
      result.user.id,
      "LOGIN",
      `Successful login for ${email}`,
      { ipAddress: ipOf(req), userAgent: req.headers["user-agent"] ?? "" }
    ).catch(() => {/* non-critical */});

    res.json({
      success: true,
      data: {
        token: result.accessToken,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      },
    });
  },

  // ── POST /api/auth/google ───────────────────────────────────────────────
  async googleAuth(req: Request, res: Response): Promise<void> {
    const { idToken } = req.body as GoogleAuthBody;
    const result = await userService.googleSignIn(idToken);

    auditService.log(
      result.user.id,
      "LOGIN",
      `Successful Google sign-in for ${result.user.email}`,
      { metadata: { method: "google" }, ipAddress: ipOf(req), userAgent: req.headers["user-agent"] ?? "" }
    ).catch(() => {/* non-critical */});

    res.json({
      success: true,
      data: {
        token: result.accessToken,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        isNewUser: result.isNewUser,
        user: result.user,
      },
    });
  },

  // ── POST /api/auth/email-otp/request ─────────────────────────────────────
  async requestEmailOtp(req: Request, res: Response): Promise<void> {
    const { email, name } = req.body as RequestEmailOtpBody;
    await userService.requestEmailOtp(email, name);
    res.json({ success: true, message: "If the address can receive mail, a code has been sent.", resendAfterSeconds: 60 });
  },

  // ── POST /api/auth/email-otp/verify ──────────────────────────────────────
  async verifyEmailOtp(req: Request, res: Response): Promise<void> {
    const { email, code, authenticatorOtp } = req.body as VerifyEmailOtpBody;
    const result = await userService.verifyEmailOtp(email, code, authenticatorOtp);
    res.json({
      success: true,
      data: {
        token: result.accessToken,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        isNewUser: result.isNewUser,
        user: result.user,
      },
    });
  },

  // ── POST /api/auth/refresh ───────────────────────────────────────────────
  async refresh(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body as RefreshBody;
    const result = await userService.refreshTokens(refreshToken);

    auditService.log(
      result.user.id,
      "TOKEN_REFRESH",
      "Access token refreshed",
      { ipAddress: ipOf(req), userAgent: req.headers["user-agent"] ?? "" }
    ).catch(() => {/* non-critical */});

    res.json({
      success: true,
      data: {
        token: result.accessToken,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      },
    });
  },

  // ── POST /api/auth/logout ────────────────────────────────────────────────
  async logout(req: Request, res: Response): Promise<void> {
    const body = req.body as Partial<LogoutBody>;
    if (body?.refreshToken) {
      await userService.logout(body.refreshToken);
    }

    // Log if we have an authenticated userId on the request
    if (req.userId) {
      auditService.log(req.userId, "LOGOUT", "User logged out", {
        ipAddress: ipOf(req),
        userAgent: req.headers["user-agent"] ?? "",
      }).catch(() => {/* non-critical */});
    }

    res.json({ success: true, message: "Logged out" });
  },

  // ── POST /api/auth/logout-all  (requires valid access token) ────────────
  async logoutAll(req: Request, res: Response): Promise<void> {
    await userService.logoutAll(req.userId);

    auditService.log(req.userId, "LOGOUT", "All sessions revoked", {
      ipAddress: ipOf(req),
      userAgent: req.headers["user-agent"] ?? "",
    }).catch(() => {/* non-critical */});

    res.json({ success: true, message: "All sessions revoked" });
  },

  // ── GET /api/auth/me ─────────────────────────────────────────────────────
  async me(req: Request, res: Response): Promise<void> {
    const user = await userService.getUserById(req.userId);
    const deviceCount = await userService.countDevices(req.userId);
    res.json({
      success: true,
      data: {
        id: user._id.toString(),
        email: user.email,
        displayName: user.displayName,
        name: user.name,
        phoneNumber: user.phoneNumber,
        twoFactorEnabled: user.twoFactorEnabled,
        protectionScore: user.protectionScore,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        linkedDeviceCount: deviceCount,
      },
    });
  },

  // ── POST /api/auth/forgot-password ───────────────────────────────────────
  async forgotPassword(req: Request, res: Response): Promise<void> {
    const { email } = req.body as ForgotPasswordBody;
    await userService.forgotPassword(email);
    
    // Always return success to prevent email enumeration
    res.json({ success: true, message: "If an account exists, a reset link was sent." });
  },

  // ── POST /api/auth/reset-password ────────────────────────────────────────
  async resetPassword(req: Request, res: Response): Promise<void> {
    const { token, password } = req.body as ResetPasswordBody;
    await userService.resetPassword(token, password);

    res.json({ success: true, message: "Password has been successfully reset" });
  },

  // ── POST /api/auth/2fa/setup (requires valid access token) ───────────────
  async setup2FA(req: Request, res: Response): Promise<void> {
    const data = await userService.setup2FA(req.userId);
    res.json({ success: true, data });
  },

  // ── POST /api/auth/2fa/verify (requires valid access token) ──────────────
  async verify2FA(req: Request, res: Response): Promise<void> {
    const { otp } = req.body as Verify2FABody;
    await userService.verify2FA(req.userId, otp);

    auditService.log(req.userId, "SETTINGS_UPDATED", "Two-factor authentication enabled", {
      ipAddress: ipOf(req),
      userAgent: req.headers["user-agent"] ?? "",
    }).catch(() => {/* non-critical */});

    res.json({ success: true, message: "Two-factor authentication enabled" });
  },

  // ── POST /api/auth/2fa/disable (requires valid access token) ─────────────
  async disable2FA(req: Request, res: Response): Promise<void> {
    const { password } = req.body as Disable2FABody;
    await userService.disable2FA(req.userId, password);

    auditService.log(req.userId, "SETTINGS_UPDATED", "Two-factor authentication disabled", {
      ipAddress: ipOf(req),
      userAgent: req.headers["user-agent"] ?? "",
    }).catch(() => {/* non-critical */});

    res.json({ success: true, message: "Two-factor authentication disabled" });
  },
};
