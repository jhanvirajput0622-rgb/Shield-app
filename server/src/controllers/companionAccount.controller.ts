import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { CompanionAccount } from "../models/CompanionAccount";
import { CompanionSession } from "../models/CompanionSession";
import { ApiError } from "../utils/ApiError";
import { auditService } from "../services/audit.service";
import {
  CreateCompanionBody,
  CompanionLoginBody,
} from "../validators/companionAccount.validator";

function ipOf(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    ""
  );
}

export const companionAccountController = {
  // GET /api/companion-accounts — get companion account for authenticated user
  async getCompanionAccount(req: Request, res: Response): Promise<void> {
    const account = await CompanionAccount.findOne({ userId: req.userId });
    if (!account) throw ApiError.notFound("CompanionAccount");

    res.json({
      success: true,
      data: {
        id: account._id.toString(),
        email: account.email,
        twoFactorEnabled: account.twoFactorEnabled,
        lastLoginAt: account.lastLoginAt?.toISOString() ?? null,
        isActive: account.isActive,
        createdAt: account.createdAt.toISOString(),
      },
    });
  },

  // POST /api/companion-accounts — create companion account
  async createCompanionAccount(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body as CreateCompanionBody;

    // One companion account per user
    const existing = await CompanionAccount.findOne({ userId: req.userId });
    if (existing) {
      throw ApiError.conflict("A companion account already exists for this user");
    }

    // Email must not already be used by another companion account
    const emailTaken = await CompanionAccount.findOne({ email });
    if (emailTaken) {
      throw ApiError.conflict("That email address is already in use");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const account = await CompanionAccount.create({
      userId: req.userId,
      email,
      passwordHash,
      // Required. `loginCompanionAccount` rejects with `forbidden` when
      // `isActive` is falsy, so omitting it here made every companion account
      // created through the API permanently unable to log in. Firestore drops
      // undefined fields, so the document simply had no `isActive` at all.
      isActive: true,
    });

    auditService.log(req.userId, "COMPANION_LOGIN", `Companion account created: ${email}`, {
      ipAddress: ipOf(req),
    }).catch(() => {});

    res.status(201).json({
      success: true,
      data: {
        id: account._id.toString(),
        email: account.email,
        twoFactorEnabled: account.twoFactorEnabled,
        createdAt: account.createdAt.toISOString(),
      },
    });
  },

  // POST /api/companion-accounts/login
  async loginCompanionAccount(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body as CompanionLoginBody;

    const account = await CompanionAccount.findOne({
      userId: req.userId,
      email,
    }).select("+passwordHash");

    if (!account) {
      // Constant-time response
      await bcrypt.compare(password, "$2b$12$invalidhashfortimingprotection00");
      throw ApiError.unauthorized("Invalid credentials");
    }

    if (!account.isActive) throw ApiError.forbidden("Companion account is inactive");

    const valid = await account.comparePassword(password);
    if (!valid) throw ApiError.unauthorized("Invalid credentials");

    account.lastLoginAt = new Date();
    await account.save();

    // Record companion session
    const session = await CompanionSession.create({
      companionId: account._id,
      userId: req.userId,
      loginTime: new Date(),
      ipAddress: ipOf(req),
      userAgent: req.headers["user-agent"] ?? "",
    });

    auditService.log(req.userId, "COMPANION_LOGIN", `Companion login: ${email}`, {
      ipAddress: ipOf(req),
      metadata: { sessionId: session._id.toString() },
    }).catch(() => {});

    res.json({
      success: true,
      data: {
        sessionId: session._id.toString(),
        email: account.email,
        loginTime: session.loginTime.toISOString(),
      },
    });
  },

  // GET /api/companion-accounts/sessions
  async listSessions(req: Request, res: Response): Promise<void> {
    const account = await CompanionAccount.findOne({ userId: req.userId });
    if (!account) throw ApiError.notFound("CompanionAccount");

    const sessions = await CompanionSession.find({
      companionId: account._id,
      userId: req.userId,
    })
      .sort({ loginTime: -1 })
      .limit(20);

    res.json({
      success: true,
      data: sessions.map((s) => ({
        id: s._id.toString(),
        loginTime: s.loginTime.toISOString(),
        logoutTime: s.logoutTime?.toISOString() ?? null,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
      })),
    });
  },

  // DELETE /api/companion-accounts — remove companion account
  async deleteCompanionAccount(req: Request, res: Response): Promise<void> {
    const account = await CompanionAccount.findOneAndDelete({ userId: req.userId });
    if (!account) throw ApiError.notFound("CompanionAccount");

    // Clean up sessions
    await CompanionSession.deleteMany({ companionId: account._id });

    auditService.log(req.userId, "COMPANION_LOGOUT", "Companion account deleted", {
      ipAddress: ipOf(req),
    }).catch(() => {});

    res.json({ success: true });
  },
};
