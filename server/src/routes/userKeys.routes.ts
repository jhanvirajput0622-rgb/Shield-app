import { Router } from "express";
import { userKeyController } from "../controllers/userKey.controller";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { createUserKeySchema } from "../validators/userKey.validator";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate);

// GET  /api/user-keys
router.get("/", asyncHandler(userKeyController.listKeys));

// POST /api/user-keys
router.post(
  "/",
  validate(createUserKeySchema),
  asyncHandler(userKeyController.createKey)
);

// DELETE /api/user-keys/:id
router.delete("/:id", asyncHandler(userKeyController.deleteKey));

export default router;
