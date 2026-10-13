/**
 * Public surface of the ERD-backed Firestore layer.
 *
 * Import services from here rather than from the individual modules, so the
 * collection layout in ./schema can be reorganised without touching call sites.
 *
 *   import { listDevices, logSecurityEvent } from "@/lib/firestore";
 *
 * Authentication itself is not in this module -- use `lib/auth.ts` for
 * sign-in/sign-up, then await the first auth state change before calling any of
 * these, since every service needs a uid.
 */

export * from "./schema";
export { crud, now, type Crud, type Batch, type Page, type ListOptions } from "./crud";
export {
  ensureFirebaseInitialized,
  getFirebaseApp,
  getFirebaseAuth,
  getFirestoreDb,
} from "../firebase";

export { currentUserId, requireUserId, isAdmin, NotSignedInError } from "./services/context";

export * as admins from "./services/admins";
export * as antiTheft from "./services/antiTheft";
export * as appPermissions from "./services/appPermissions";
export * as appSessions from "./services/appSessions";
export * as auditEvents from "./services/auditEvents";
export * as devices from "./services/devices";
export * as phishingDetection from "./services/phishingDetection";
export * as protectionSettings from "./services/protectionSettings";
export * as securityLogs from "./services/securityLogs";
export * as users from "./services/users";
export * as vpnConnections from "./services/vpnConnections";
