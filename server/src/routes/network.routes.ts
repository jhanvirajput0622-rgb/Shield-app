import { Router } from "express";
import { networkController } from "../controllers/network.controller";
import { authenticate } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate);

// GET  /api/shield/network
router.get("/", asyncHandler(networkController.getNetworkStatus));

// POST /api/shield/vpn/connect
router.post("/vpn/connect", asyncHandler(networkController.connectVpn));

// POST /api/shield/vpn/disconnect
router.post("/vpn/disconnect", asyncHandler(networkController.disconnectVpn));

export default router;
