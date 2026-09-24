import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { validate } from "../middleware/validate.middleware";
import { authenticate } from "../middleware/auth.middleware";
import { authLimiter } from "../middleware/rateLimiter.middleware";
import {
  registerSchema,
  loginSchema,
  googleAuthSchema,
  refreshSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verify2FASchema,
  disable2FASchema,
} from "../validators/auth.validator";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// POST /api/auth/register
router.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  asyncHandler(authController.register)
);

// POST /api/auth/login
router.post(
  "/login",
  authLimiter,
  validate(loginSchema),
  asyncHandler(authController.login)
);

// POST /api/auth/refresh  (no access token required — uses refresh token)
router.post(
  "/refresh",
  authLimiter,
  validate(refreshSchema),
  asyncHandler(authController.refresh)
);
// POST /api/auth/google  (verifies a Google ID token, signs in or signs up)
router.post(
  "/google",
  authLimiter,
  validate(googleAuthSchema),
  asyncHandler(authController.googleAuth)
);

// POST /api/auth/logout  (refresh token in body, access token optional)
router.post(
  "/logout",
  validate(logoutSchema),
  asyncHandler(authController.logout)
);

// POST /api/auth/logout-all  (requires valid access token)
router.post(
  "/logout-all",
  authenticate,
  asyncHandler(authController.logoutAll)
);

// GET /api/auth/me  (requires valid access token)
router.get("/me", authenticate, asyncHandler(authController.me));

// POST /api/auth/forgot-password
router.post(
  "/forgot-password",
  authLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(authController.forgotPassword)
);

// POST /api/auth/reset-password
router.post(
  "/reset-password",
  authLimiter,
  validate(resetPasswordSchema),
  asyncHandler(authController.resetPassword)
);

// POST /api/auth/2fa/setup
router.post(
  "/2fa/setup",
  authenticate,
  asyncHandler(authController.setup2FA)
);

// POST /api/auth/2fa/verify
router.post(
  "/2fa/verify",
  authenticate,
  validate(verify2FASchema),
  asyncHandler(authController.verify2FA)
);

// POST /api/auth/2fa/disable
router.post(
  "/2fa/disable",
  authenticate,
  validate(disable2FASchema),
  asyncHandler(authController.disable2FA)
);

export default router;
