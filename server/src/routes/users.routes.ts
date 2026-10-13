import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import { User } from "../models/User";
import { Device } from "../models/Device";
import { Settings } from "../models/Settings";
import { RefreshToken } from "../models/RefreshToken";
import { AuditLog } from "../models/AuditLog";
import { Notification } from "../models/Notification";
import { VpnSession } from "../models/VpnSession";
import { PhishingCheck } from "../models/PhishingCheck";
import { SecurityEvent } from "../models/SecurityEvent";
import { AppPermissionScan } from "../models/AppPermissionScan";
import { auditService } from "../services/audit.service";

const router = Router();
router.use(authenticate);

// GET /api/users/me — returns current authenticated user profile
router.get(
  "/me",
  asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findById(req.userId).lean();
    if (!user) {
      res.status(404).json({ success: false, error: { message: "User not found" } });
      return;
    }
    res.json({
      success: true,
      data: {
        id: user._id.toString(),
        email: user.email,
        displayName: user.displayName,
        name: user.name,
        phoneNumber: user.phoneNumber ?? null,
        twoFactorEnabled: user.twoFactorEnabled,
        protectionScore: user.protectionScore,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      },
    });
  })
);

// DELETE /api/users/me — permanently deletes the authenticated user's account
// and all associated data. Requires a valid access token.
router.delete(
  "/me",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.userId;

    // Write an audit entry before deleting so there's a record
    await auditService
      .log(userId, "LOGOUT", "Account permanently deleted by user", {
        ipAddress:
          (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
          req.socket.remoteAddress ??
          "",
      })
      .catch(() => {/* non-critical */});

    // Delete all user data in parallel
    await Promise.all([
      Device.deleteMany({ userId }),
      Settings.deleteMany({ userId }),
      RefreshToken.deleteMany({ userId }),
      VpnSession.deleteMany({ userId }),
      PhishingCheck.deleteMany({ userId }),
      SecurityEvent.deleteMany({ userId }),
      AppPermissionScan.deleteMany({ userId }),
      Notification.deleteMany({ userId }),
      AuditLog.deleteMany({ userId }),
    ]);

    // Finally delete the user document itself
    await User.deleteOne({ _id: userId });

    res.json({ success: true, message: "Account deleted" });
  })
);

export default router;
