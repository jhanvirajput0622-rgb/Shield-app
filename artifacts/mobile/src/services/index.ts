/**
 * Shield service layer — re-exports all service modules.
 * Import from here: `import { authService, dashboardService } from "@/src/services"`
 */
export * as authService       from "./authService";
export * as dashboardService  from "./dashboardService";
export * as deviceService     from "./deviceService";
export * as securityService   from "./securityService";
export * as vpnService        from "./vpnService";
export * as wifiService       from "./wifiService";
export * as theftService      from "./theftService";
export * as permissionService from "./permissionService";
export { apiFetch, getApiBaseUrl, ApiServiceError } from "./api";
