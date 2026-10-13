/**
 * ERD entity 6 -- VPNConnection.
 *
 * A row spans one tunnel: written on connect with `disconnectedAt: null` and
 * patched on disconnect. `duration` is stored in seconds rather than recomputed
 * from the two timestamps, because the clock on a device that has been asleep
 * is not a reliable basis for a billed number and the value is reported
 * verbatim to the user.
 */

import { crud, now } from "../crud";
import type { ConnectionStatus, VPNConnectionDoc, WithId } from "../schema";
import { requireUserId } from "./context";

const vpnCrud = crud("vpnConnections");

export interface ConnectInput {
  serverLocation: string;
  ipAddress?: string | null;
}

export async function openConnection(input: ConnectInput): Promise<string> {
  const data: VPNConnectionDoc = {
    userId: requireUserId(),
    serverLocation: input.serverLocation,
    connectionStatus: "connecting",
    ipAddress: input.ipAddress ?? null,
    connectedAt: now(),
    disconnectedAt: null,
    duration: null,
  };
  return vpnCrud.create(data);
}

export function markConnected(vpnId: string, ipAddress: string): Promise<void> {
  return vpnCrud.update(vpnId, { connectionStatus: "connected", ipAddress });
}

/**
 * Close the tunnel. `duration` is passed explicitly rather than derived, so the
 * caller decides how to measure it (see the header note on device clocks).
 */
export function closeConnection(vpnId: string, durationSeconds: number): Promise<void> {
  return vpnCrud.update(vpnId, {
    connectionStatus: "disconnected",
    disconnectedAt: now(),
    duration: Math.max(0, Math.round(durationSeconds)),
  });
}

export function markFailed(vpnId: string): Promise<void> {
  return vpnCrud.update(vpnId, {
    connectionStatus: "failed",
    disconnectedAt: now(),
    duration: 0,
  });
}

export function getConnection(vpnId: string): Promise<WithId<VPNConnectionDoc> | null> {
  return vpnCrud.get(vpnId);
}

/** The tunnel currently up, if any. */
export function getActiveConnection(): Promise<WithId<VPNConnectionDoc> | null> {
  return vpnCrud
    .list({
      filters: { userId: requireUserId(), connectionStatus: "connected" },
      orderBy: [{ field: "connectedAt", direction: "desc" }],
      limit: 1,
    })
    .then((rows) => rows[0] ?? null);
}

export function listConnections(pageSize = 25, startAfterId?: string) {
  return vpnCrud.paginate({
    filters: { userId: requireUserId() },
    orderBy: [{ field: "connectedAt", direction: "desc" }],
    pageSize,
    startAfterId,
  });
}

export function listConnectionsByStatus(
  status: ConnectionStatus
): Promise<WithId<VPNConnectionDoc>[]> {
  return vpnCrud.list({
    filters: { userId: requireUserId(), connectionStatus: status },
    orderBy: [{ field: "connectedAt", direction: "desc" }],
  });
}

/**
 * Total seconds across closed tunnels, for the dashboard summary.
 *
 * This sums in the client because Firestore has no aggregate sum -- only a
 * count -- so the rows have to be read. The 10,000 ceiling is Firestore's
 * per-query limit; a user with more tunnel history than that needs a server-side
 * rollup instead, since this would silently under-report.
 */
export async function totalConnectedSeconds(): Promise<number> {
  const rows = await vpnCrud.list({ filters: { userId: requireUserId() }, limit: 10_000 });
  return rows.reduce((sum, row) => sum + (row.duration ?? 0), 0);
}

export function subscribeToActiveConnection(
  onNext: (connection: WithId<VPNConnectionDoc> | null) => void,
  onError?: (error: Error) => void
): () => void {
  return vpnCrud.subscribe(
    {
      filters: { userId: requireUserId(), connectionStatus: "connected" },
      orderBy: [{ field: "connectedAt", direction: "desc" }],
      limit: 1,
    },
    (rows) => onNext(rows[0] ?? null),
    onError
  );
}
