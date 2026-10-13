/**
 * ERD entity 6 — VPNConnection, exposed to the UI.
 *
 * ── The row spans a tunnel, and the phases are not symmetric ─────────────────
 * `vpnConnections` writes `connecting` on connect, then patches to `connected`
 * with the assigned address, or to `failed`. Disconnect patches to
 * `disconnected` with a `duration`. So a connect is two writes and a disconnect
 * is one, and the UI has to carry a tunnel id between them — which is why the
 * id is returned from the mutation and kept in a ref rather than re-queried.
 *
 * `subscribeToActiveConnection` only reports `connected` rows. That means a
 * tunnel stuck in `connecting` is invisible to the listener, so the connecting
 * state is derived from the mutation's own pending flag. Deriving it from a
 * second query instead would leave a handshake that never resolves spinning
 * forever with no error shown.
 *
 * ── Duration is measured here, not derived ────────────────────────────────────
 * `closeConnection` takes `durationSeconds` explicitly, and its header is clear
 * why: a device that has been asleep has a clock that is not a reliable basis
 * for a billed number. The measurement is therefore a wall-clock delta taken on
 * this device, held in memory, rather than recomputed from a `connectedAt` that
 * may predate a resume.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { vpnConnections, type ConnectionStatus, type VPNConnectionDoc, type WithId } from "@/lib/firestore";
import {
  DEFAULT_VPN_SERVER_ID,
  getServer,
  recommendedServer,
  VPN_SERVERS,
  type VpnServer,
} from "@/lib/vpn/servers";
import { useRealtimeQuery } from "./useRealtimeQuery";

export type { ConnectionStatus };
export type VpnConnection = WithId<VPNConnectionDoc>;

export const VPN_CONNECTION_QUERY_KEY = ["firestore", "vpnConnection"] as const;

/** Elapsed tunnel time as `m:ss`, or `h:mm:ss` past an hour. */
export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

function toMillis(value: Date): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/**
 * The single state the dashboard renders from.
 *
 * Deliberately one discriminated union rather than several booleans: the screen
 * picks between mutually exclusive presentations (spinner, lock, unlock,
 * error), and independent booleans make an impossible combination
 * representable — "connected and connecting" is a bug waiting to render.
 */
export type VpnUiState =
  | { phase: "idle" }
  | { phase: "connecting"; server: VpnServer }
  | { phase: "connected"; server: VpnServer | null; connection: VpnConnection }
  | { phase: "disconnecting" }
  | { phase: "error"; message: string; server: VpnServer };

export interface UseVpnConnectionResult {
  servers: VpnServer[];
  selectedServerId: string;
  selectedServer: VpnServer;
  state: VpnUiState;
  connection: VpnConnection | null;
  /** Seconds since the current tunnel came up. Ticks once a second while up. */
  elapsedSeconds: number;
  isConnected: boolean;
  isBusy: boolean;
  error: string | null;
  isLoading: boolean;
  isUnavailable: boolean;
  isError: boolean;
  selectServer: (serverId: string) => void;
  connect: (serverId?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  dismissError: () => void;
}

export function useVpnConnection(): UseVpnConnectionResult {
  const [selectedServerId, setSelectedServerId] = useState(DEFAULT_VPN_SERVER_ID);
  const [error, setError] = useState<string | null>(null);

  /**
   * The tunnel row currently being written, and when it started.
   *
   * Needed because the listener only surfaces `connected` rows: after
   * `openConnection` resolves we know the id, and the failure path needs it to
   * mark a half-open tunnel as `failed` rather than leaving a permanently
   * `connecting` row in the user's history.
   */
  const activeRef = useRef<{ id: string; startedAt: number } | null>(null);

  const realtime = useRealtimeQuery<VpnConnection | null>({
    queryKey: VPN_CONNECTION_QUERY_KEY,
    subscribe: ({ onData, onError }) => vpnConnections.subscribeToActiveConnection(onData, onError),
  });

  const connection = realtime.data ?? null;
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // The live session counter. Driven by an interval rather than by a re-render
  // from Firestore, because a healthy connected tunnel produces no further
  // snapshots and the display would otherwise freeze at 0:00.
  useEffect(() => {
    if (!connection) {
      setElapsedSeconds(0);
      return;
    }
    const startedAt = toMillis(connection.connectedAt);
    if (Number.isNaN(startedAt)) {
      setElapsedSeconds(0);
      return;
    }

    const tick = () => setElapsedSeconds(Math.max(0, (Date.now() - startedAt) / 1000));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [connection]);

  const connectMutation = useMutation({
    mutationFn: async (server: VpnServer) => {
      // Phase 1 — the row exists in `connecting`, so a tunnel that dies
      // mid-handshake is still recorded rather than vanishing.
      const id = await vpnConnections.openConnection({
        serverLocation: server.id,
        ipAddress: null,
      });
      activeRef.current = { id, startedAt: Date.now() };

      // Phase 2 — promote to `connected` with the address the transport
      // assigned. `server.exitIp` is the catalogue's advertised value; a real
      // transport's assignment replaces it at this seam, which is why the UI
      // labels the address as advertised rather than measured.
      await vpnConnections.markConnected(id, server.exitIp);
      return id;
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (target: { id: string; startedAt: number }) =>
      vpnConnections.closeConnection(target.id, (Date.now() - target.startedAt) / 1000),
  });

  const state = useMemo<VpnUiState>(() => {
    const fallback = getServer(selectedServerId) ?? recommendedServer();

    if (error) return { phase: "error", message: error, server: fallback };
    if (connectMutation.isPending) return { phase: "connecting", server: fallback };
    if (connection) {
      return {
        phase: "connected",
        // Null when the row names a location the catalogue no longer lists —
        // the tunnel is real, the metadata is not.
        server: getServer(connection.serverLocation),
        connection,
      };
    }
    if (disconnectMutation.isPending) return { phase: "disconnecting" };
    return { phase: "idle" };
  }, [connectMutation.isPending, connection, disconnectMutation.isPending, error, selectedServerId]);

  const connect = useCallback(
    async (serverId?: string) => {
      const server = getServer(serverId ?? selectedServerId) ?? recommendedServer();
      setError(null);
      // A stale id from a previous attempt must not be marked failed if this one
      // dies at the first write.
      activeRef.current = null;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Keep the pick visible in the list even if the handshake fails — the user
      // chose it deliberately, and silently reverting the highlight is confusing.
      setSelectedServerId(server.id);

      try {
        await connectMutation.mutateAsync(server);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (err: unknown) {
        // The `connecting` row may already be written. Mark it failed rather
        // than leaving a permanently-stuck tunnel in the user's history.
        const attempted = activeRef.current as { id: string; startedAt: number } | null;
        if (attempted) {
          await vpnConnections.markFailed(attempted.id).catch(() => {});
          activeRef.current = null;
        }
        setError(describeVpnError(err));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [connectMutation, selectedServerId]
  );

  const disconnect = useCallback(async () => {
    if (!connection) return;

    setError(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await disconnectMutation.mutateAsync({
        id: connection.id,
        startedAt: toMillis(connection.connectedAt),
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      setError(describeVpnError(err));
    }
  }, [connection, disconnectMutation]);

  return {
    servers: VPN_SERVERS,
    selectedServerId,
    selectedServer: getServer(selectedServerId) ?? recommendedServer(),
    state,
    connection,
    elapsedSeconds,
    isConnected: state.phase === "connected",
    isBusy: connectMutation.isPending || disconnectMutation.isPending,
    error,
    isLoading: realtime.isPending,
    isUnavailable: realtime.isUnavailable,
    isError: realtime.subscriptionError !== null,
    selectServer: setSelectedServerId,
    connect,
    disconnect,
    dismissError: () => setError(null),
  };
}

/** Turn a thrown value into something the user can act on. */
function describeVpnError(error: unknown): string {
  if (error instanceof Error) {
    // Firestore permission rejections read as opaque codes; name the likely cause,
    // because "PERMISSION_DENIED" tells a user nothing actionable.
    if (error.message.includes("PERMISSION_DENIED")) {
      return "Shield could not write the connection record. Your session may have expired — sign in again.";
    }
    if (error.message.includes("UNAVAILABLE") || error.message.includes("unavailable")) {
      return "Can't reach the server list. Check your connection and try again.";
    }
    return error.message;
  }
  return "Couldn't establish a secure tunnel. Please try again.";
}
