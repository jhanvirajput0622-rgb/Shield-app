import { Request, Response } from "express";
import { permissionScanService } from "../services/permissionScan.service";

export const permissionsController = {
  async getPermissions(req: Request, res: Response): Promise<void> {
    const scan = await permissionScanService.getLatestScan(req.userId);

    if (!scan) {
      res.json({
        apps: [],
        totalApps: 0,
        highRiskCount: 0,
        lastScannedAt: new Date().toISOString(),
      });
      return;
    }

    res.json({
      apps: scan.apps.map((a) => ({
        id: `${a.packageName}`,
        name: a.appName,
        packageName: a.packageName,
        category: a.category,
        requestedPermissions: a.requestedPermissions,
        riskScore: a.riskScore,
        riskLevel: a.riskLevel,
        riskReasons: a.riskReasons,
        lastScannedAt: scan.scannedAt.toISOString(),
      })),
      totalApps: scan.totalApps,
      highRiskCount: scan.highRiskCount,
      lastScannedAt: scan.scannedAt.toISOString(),
    });
  },

  async runScan(req: Request, res: Response): Promise<void> {
    // The mobile client submits the raw app list.
    // Body may be empty on first scan — server handles it gracefully.
    const rawApps: Array<{
      appName: string;
      packageName: string;
      category?: string;
      requestedPermissions: string[];
    }> = req.body?.apps ?? [];

    const scan = await permissionScanService.runScan(req.userId, rawApps);

    res.json({
      apps: scan.apps.map((a) => ({
        id: `${a.packageName}`,
        name: a.appName,
        packageName: a.packageName,
        category: a.category,
        requestedPermissions: a.requestedPermissions,
        riskScore: a.riskScore,
        riskLevel: a.riskLevel,
        riskReasons: a.riskReasons,
        lastScannedAt: scan.scannedAt.toISOString(),
      })),
      totalApps: scan.totalApps,
      highRiskCount: scan.highRiskCount,
      lastScannedAt: scan.scannedAt.toISOString(),
    });
  },
};
