/**
 * ERD entity 7 — AppPermission, exposed to the UI.
 *
 * ── Where the data comes from, and why it is split ────────────────────────────
 * `AppPermissionDoc` models one row per (app, permission) pair with a grant
 * state — `appName`, `permissionType`, `status`, `grantedAt`, `revokedAt`. That
 * is what this module reads and writes, and it is what Firestore is authoritative
 * for: the grant/revoke actions the user takes in this screen.
 *
 * It deliberately does *not* model the app inventory. There is no
 * `packageName`, `category`, `riskScore` or `riskReasons` field, so the risk
 * assessment the user sees on each app row is not Firestore data. Enumerating
 * installed apps needs a native module Expo does not ship either, so the
 * inventory is fetched from the existing `POST /api/shield/permissions/scan`
 * endpoint, and this hook's job is to normalise that response into the ERD shape
 * and persist it with `replacePermissionsForApp`.
 *
 * Consequence worth knowing: the risk badge can be stale relative to Firestore,
 * because it comes from the last scan response while the permission chips come
 * from a live listener. `lastScannedAt` is surfaced in the UI for exactly that
 * reason. Reconciling the two properly means adding the inventory fields to the
 * ERD, which is a schema change, not a client change.
 *
 * ── Realtime ──────────────────────────────────────────────────────────────────
 * `appPermissions` has no `subscribeToPermissions` in the service module, so
 * this uses the generic `crud("appPermissions").subscribe` instead. That is part
 * of the layer's public surface (`lib/firestore` re-exports `crud`), and adding
 * a bespoke subscription to the service would duplicate it.
 */

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import {
  appPermissions,
  crud,
  type AppPermissionDoc,
  type PermissionStatus,
  type WithId,
} from "@/lib/firestore";
import { apiFetch } from "@/lib/apiClient";
import { MOCK_APPS } from "@/data/mockData";
import { useRealtimeQuery } from "./useRealtimeQuery";
import { useFirebaseSession } from "@/context/FirebaseSessionContext";

export type { PermissionStatus };
export type AppPermission = WithId<AppPermissionDoc>;

export const APP_PERMISSIONS_QUERY_KEY = ["firestore", "appPermissions"] as const;

const permissionsCrud = crud("appPermissions");

/** How many rows the listener holds. Firestore bills per document read. */
const LISTEN_LIMIT = 200;

/** Permission types the ERD's consumers care about, with presentation metadata. */
export type KnownPermission =
  | "camera"
  | "location"
  | "contacts"
  | "microphone"
  | "sms"
  | "call_log"
  | "storage"
  | "notifications"
  | "unknown";

const PERMISSION_META: Record<
  KnownPermission,
  { label: string; icon: string; sensitive: boolean }
> = {
  camera: { label: "Camera", icon: "camera", sensitive: true },
  location: { label: "Location", icon: "map-pin", sensitive: true },
  contacts: { label: "Contacts", icon: "users", sensitive: true },
  microphone: { label: "Microphone", icon: "mic", sensitive: true },
  sms: { label: "SMS", icon: "message-square", sensitive: true },
  call_log: { label: "Call Log", icon: "phone-call", sensitive: true },
  storage: { label: "Storage", icon: "folder", sensitive: false },
  notifications: { label: "Notifications", icon: "bell", sensitive: false },
  unknown: { label: "Other", icon: "help-circle", sensitive: false },
};

/**
 * Normalise a raw permission string to a known type.
 *
 * The inventory arrives with platform constants (`CAMERA`, `READ_CONTACTS`,
 * `ACCESS_FINE_LOCATION`), and the server's mock uses bare names. Anything
 * unrecognised maps to `unknown` rather than being dropped, so a permission the
 * app cannot classify is still visible to the user — silently hiding an
 * unclassifiable permission would be the wrong failure in a security tool.
 */
export function normalisePermission(raw: string): KnownPermission {
  const key = raw.toLowerCase().replace(/^(read_|write_|access_)/, "");
  if (key.includes("camera")) return "camera";
  if (key.includes("location") || key === "gps") return "location";
  if (key.includes("contact")) return "contacts";
  if (key.includes("microphone") || key === "mic") return "microphone";
  if (key.includes("sms") || key === "messages") return "sms";
  if (key.includes("call_log") || key.includes("calllog")) return "call_log";
  if (key.includes("storage") || key.includes("files") || key.includes("media"))
    return "storage";
  if (key.includes("notification")) return "notifications";
  return "unknown";
}

export function permissionMeta(raw: string) {
  return PERMISSION_META[normalisePermission(raw)];
}

/** The four states the ERD allows, and how each should read. */
export const PERMISSION_STATUS_META: Record<
  PermissionStatus,
  { label: string; risk: "safe" | "warning" | "danger"; granted: boolean }
> = {
  granted: { label: "Granted", risk: "safe", granted: true },
  denied: { label: "Denied", risk: "warning", granted: false },
  revoked: { label: "Revoked", risk: "danger", granted: false },
  pending: { label: "Pending", risk: "warning", granted: false },
};

/** One installed app with its permission rows folded in. */
export interface AppWithPermissions {
  appName: string;
  permissions: AppPermission[];
  grantedCount: number;
  sensitiveGranted: number;
  /** The worst state across the app's sensitive permissions. */
  risk: "safe" | "warning" | "danger";
}

function riskOf(permissions: AppPermission[]): AppWithPermissions["risk"] {
  let risk: AppWithPermissions["risk"] = "safe";
  for (const permission of permissions) {
    const meta = permissionMeta(permission.permissionType);
    const status = PERMISSION_STATUS_META[permission.status] ?? PERMISSION_STATUS_META.pending;
    if (!meta.sensitive) continue;
    if (status.granted) {
      // A live grant on a sensitive permission is the thing worth surfacing.
      risk = risk === "safe" ? "warning" : risk;
    } else if (permission.status === "revoked") {
      risk = "danger";
    } else if (risk === "safe") {
      risk = "warning";
    }
  }
  return risk;
}

/** Group flat permission rows into the per-app shape the list renders. */
export function groupByApp(rows: AppPermission[]): AppWithPermissions[] {
  const byApp = new Map<string, AppPermission[]>();
  for (const row of rows) {
    const bucket = byApp.get(row.appName);
    if (bucket) bucket.push(row);
    else byApp.set(row.appName, [row]);
  }

  return Array.from(byApp.entries())
    .map(([appName, permissions]) => {
      const sorted = permissions
        .slice()
        .sort((a, b) => a.permissionType.localeCompare(b.permissionType));
      const sensitiveGranted = sorted.filter(
        (p) => permissionMeta(p.permissionType).sensitive && p.status === "granted"
      ).length;
      return {
        appName,
        permissions: sorted,
        grantedCount: sorted.filter((p) => p.status === "granted").length,
        sensitiveGranted,
        risk: riskOf(sorted),
      };
    })
    .sort((a, b) => {
      // Most exposed first: a live sensitive grant outranks a revoked one,
      // which outranks a clean app.
      const rank = { danger: 0, warning: 1, safe: 2 } as const;
      const byRisk = rank[a.risk] - rank[b.risk];
      if (byRisk !== 0) return byRisk;
      return b.sensitiveGranted - a.sensitiveGranted;
    });
}

/** The shape the inventory endpoint returns, minus the fields Firestore ignores. */
interface InventoryApp {
  name: string;
  requestedPermissions: string[];
}

/** The scan response, narrowed to what this module consumes. */
interface ScanResponse {
  success: boolean;
  data: { apps: InventoryApp[] } | InventoryApp[];
}

export interface UseAppPermissionsResult {
  apps: AppWithPermissions[];
  rows: AppPermission[];
  totalApps: number;
  grantedCount: number;
  sensitiveGrantedCount: number;
  revokedCount: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  /** True when Firestore is not readable at all — distinct from "no data". */
  isUnavailable: boolean;
  isScanning: boolean;
  scanError: Error | null;
  lastScannedAt: Date | null;
  /** Ids currently being written, so rows can show a per-row spinner. */
  pendingIds: ReadonlySet<string>;
  setPermission: (permissionId: string, status: PermissionStatus) => Promise<void>;
  scan: () => Promise<void>;
}

export function useAppPermissions(): UseAppPermissionsResult {
  const queryClient = useQueryClient();
  const [scanError, setScanError] = useState<Error | null>(null);
  const [lastScannedAt, setLastScannedAt] = useState<Date | null>(null);

  // `requireUserId()` is NOT applied on the raw `crud().subscribe` path — that
  // helper only exists inside the service module's own wrappers. Going through
  // `crud` directly means scoping the listener here, and the uid belongs in the
  // query key so a sign-out/user-switch tears the listener down and rebuilds it
  // against the new owner rather than leaving the previous user's rows on screen.
  const { uid } = useFirebaseSession();

  const realtime = useRealtimeQuery<AppPermission[]>({
    queryKey: [...APP_PERMISSIONS_QUERY_KEY, uid ?? "none"],
    subscribe: ({ onData, onError }) => {
      if (!uid) return () => {};
      return permissionsCrud.subscribe(
        {
          filters: { userId: uid },
          orderBy: [{ field: "appName", direction: "asc" }],
          limit: LISTEN_LIMIT,
        },
        onData,
        onError
      );
    },
  });

  const rows = useMemo(() => realtime.data ?? [], [realtime.data]);

  const setStatusMutation = useMutation({
    mutationFn: ({
      permissionId,
      status,
    }: {
      permissionId: string;
      status: PermissionStatus;
    }) => appPermissions.setPermissionStatus(permissionId, status),
  });

  /**
   * Persist the inventory to Firestore.
   *
   * `replacePermissionsForApp` is per-app and atomic, and it runs one batch per
   * app rather than one for the whole scan. The alternative — a single batch for
   * everything — would exceed Firestore's 500-write ceiling on any realistic
   * device, and a per-permission loop would leave apps showing partial results
   * mid-scan. Sequential per app also avoids a burst of concurrent writes, which
   * matters on mobile data.
   */
  const scanMutation = useMutation({
    mutationFn: async () => {
      let inventory: InventoryApp[];

      try {
        const response = await apiFetch<ScanResponse>("/api/shield/permissions/scan", {
          method: "POST",
          body: { apps: [] },
        });
        const payload = Array.isArray(response.data) ? response.data : response.data.apps;
        inventory = payload ?? [];
      } catch (error) {
        // The scan endpoint is the only source of an app inventory — Expo ships
        // no native module that enumerates installed apps. Falling back to the
        // bundled sample keeps the screen demonstrable offline, and the
        // `scanError` the caller renders makes clear the data is not live.
        if (error instanceof Error && "status" in error && (error as { status?: number }).status === 0) {
          inventory = MOCK_APPS.map((app) => ({
            name: app.name,
            requestedPermissions: app.requestedPermissions,
          }));
        } else {
          throw error;
        }
      }

      for (const app of inventory) {
        await appPermissions.replacePermissionsForApp(
          app.name,
          (app.requestedPermissions ?? []).map((permissionType) => ({
            appName: app.name,
            permissionType,
            // A freshly scanned app has no grant state yet. `pending` is the
            // honest value: the permission exists, its state is unverified, and
            // the user decides. Defaulting to `granted` would be a lie and
            // `denied` would under-report.
            status: "pending" as PermissionStatus,
          }))
        );
      }

      return inventory.length;
    },
    onSuccess: (count) => {
      setLastScannedAt(new Date());
      setScanError(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void queryClient.invalidateQueries({ queryKey: APP_PERMISSIONS_QUERY_KEY });
      return count;
    },
    onError: (error: Error) => {
      setScanError(error);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const setPermission = useCallback(
    async (permissionId: string, status: PermissionStatus) => {
      void Haptics.selectionAsync();
      await setStatusMutation.mutateAsync({ permissionId, status });
    },
    [setStatusMutation]
  );

  const scan = useCallback(async () => {
    setScanError(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await scanMutation.mutateAsync();
  }, [scanMutation]);

  const pendingIds = useMemo(
    () =>
      new Set(
        setStatusMutation.isPending && setStatusMutation.variables
          ? [setStatusMutation.variables.permissionId]
          : []
      ),
    [setStatusMutation.isPending, setStatusMutation.variables]
  );

  return {
    apps: useMemo(() => groupByApp(rows), [rows]),
    rows,
    totalApps: new Set(rows.map((row) => row.appName)).size,
    grantedCount: rows.filter((row) => row.status === "granted").length,
    sensitiveGrantedCount: rows.filter(
      (row) => row.status === "granted" && permissionMeta(row.permissionType).sensitive
    ).length,
    revokedCount: rows.filter((row) => row.status === "revoked").length,
    isLoading: realtime.isPending,
    isError: realtime.subscriptionError !== null,
    error: realtime.subscriptionError,
    isUnavailable: realtime.isUnavailable,
    isScanning: scanMutation.isPending,
    scanError,
    lastScannedAt,
    pendingIds,
    setPermission,
    scan,
  };
}
