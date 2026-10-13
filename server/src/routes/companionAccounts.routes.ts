import { Router } from "express";
import { companionAccountController } from "../controllers/companionAccount.controller";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  createCompanionSchema,
  companionLoginSchema,
} from "../validators/companionAccount.validator";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate);

// GET    /api/companion-accounts
router.get("/", asyncHandler(companionAccountController.getCompanionAccount));

// POST   /api/companion-accounts
router.post(
  "/",
  validate(createCompanionSchema),
  asyncHandler(companionAccountController.createCompanionAccount)
);

// POST   /api/companion-accounts/login
router.post(
  "/login",
  validate(companionLoginSchema),
  asyncHandler(companionAccountController.loginCompanionAccount)
);

// GET    /api/companion-accounts/sessions
router.get(
  "/sessions",
  asyncHandler(companionAccountController.listSessions)
);

// DELETE /api/companion-accounts
router.delete(
  "/",
  asyncHandler(companionAccountController.deleteCompanionAccount)
);

export default router;
