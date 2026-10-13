/**
 * Realtime Firestore reads as TanStack Query entries.
 *
 * ── Why the bridge is needed ──────────────────────────────────────────────────
 * The services in `lib/firestore/services/` expose `subscribeToX` callbacks, and
 * `crud()` exposes a raw `subscribe`. TanStack Query has no first-class
 * Firestore listener, and mixing the two naively produces the usual mess: a
 * `useQuery` that fetches once alongside a separate `onSnapshot` that writes to
 * component state, with two sources of truth and no way to invalidate the
 * mutation cache when a listener pushes an update.
 *
 * Instead, the listener IS the query. It owns the cache entry via
 * `queryClient.setQueryData`, so mutations, `invalidateQueries` and the hook
 * return values all read the same data, and a mutation's `onSuccess` can
 * invalidate normally without racing the listener.
 *
 * ── Status semantics ─────────────────────────────────────────────────────────
 * `isPending` until the first snapshot, so a screen shows a spinner rather than
 * an empty state. A listener error is returned as `subscriptionError` alongside
 * the query rather than pushed into the query's error channel: TanStack Query has
 * no public "set this query's error" API, and faking one with
 * `invalidateQueries` + `refetch` would produce a second, permanently-failing
 * fetch. Firestore reports permission denials through this path, so callers must
 * render it as a caution and never as "no data".
 */

import { useEffect, useRef, useState } from "react";
import {
  hashKey,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";

import { useFirestoreReady } from "@/context/FirebaseSessionContext";

/** Matches `Unsubscribe` from the Firestore SDK, without importing it here. */
export type Unsubscribe = () => void;

export interface RealtimeHandlers<T> {
  onData: (value: T) => void;
  onError: (error: Error) => void;
}

export interface RealtimeOptions<T> {
  /**
   * Cache key. Must be stable and must include every input to `subscribe` —
   * filter arguments in particular, or two different filters will fight over one
   * cache entry and the UI will show whichever listener mounted last.
   */
  queryKey: QueryKey;
  /**
   * Starts the listener. Called only once Firestore is readable, and must return
   * a synchronous teardown.
   */
  subscribe: (handlers: RealtimeHandlers<T>) => Unsubscribe;
  select?: (rows: T) => T;
}

export interface RealtimeResult<T> {
  data: T | undefined;
  /** True until the first snapshot arrives. */
  isPending: boolean;
  /** Non-null when the listener itself failed. */
  subscriptionError: Error | null;
  /**
   * True when the listener never started — no Firebase session, or Auth is still
   * restoring. Distinct from "the collection is empty", which is
   * `isPending === false && data` with an empty list.
   */
  isUnavailable: boolean;
}

export function useRealtimeQuery<T>(options: RealtimeOptions<T>): RealtimeResult<T> {
  const queryClient = useQueryClient();
  const firestoreReady = useFirestoreReady();
  const [subscriptionError, setSubscriptionError] = useState<Error | null>(null);

  const { queryKey, select } = options;

  // Referential identity would be wrong here: callers routinely pass an inline
  // `["logs", filter]` literal, which is a new array every render and would tear
  // down and rebuild the listener on every frame. `hashKey` produces the same
  // stable string TanStack Query uses internally, so the effect only re-runs
  // when the key's *contents* change.
  const keyHash = hashKey(queryKey);

  // `subscribe` is a fresh closure each render by construction. The effect
  // reads it through a ref so it does not become a dependency — the key hash is
  // what identifies a distinct subscription.
  const subscribeRef = useRef(options.subscribe);
  subscribeRef.current = options.subscribe;

  const query = useQuery<T>({
    queryKey,
    enabled: firestoreReady,
    queryFn: () => {
      throw new Error(
        `useRealtimeQuery("${String(queryKey[0])}") fell through to queryFn. ` +
          "The listener did not start — check that `enabled` allowed it."
      );
    },
    staleTime: Infinity,
    gcTime: 5 * 60_000,
    retry: false,
  });

  useEffect(() => {
    if (!firestoreReady) {
      setSubscriptionError(null);
      return;
    }

    setSubscriptionError(null);

    const unsubscribe = subscribeRef.current({
      onData: (value) => {
        // Routed through the query cache rather than component state, so a
        // mutation that invalidates this key and a snapshot arriving mid-mutation
        // cannot overwrite each other: the cache write is atomic.
        queryClient.setQueryData<T>(queryKey, value);
      },
      onError: (error) => {
        setSubscriptionError(error);
      },
    });

    return () => {
      unsubscribe();
      // Drop the cache entry on unmount so a later mount re-reads from the
      // server instead of flashing the previous user's rows first.
      queryClient.removeQueries({ queryKey });
    };
  }, [firestoreReady, keyHash, queryClient, queryKey]);

  const data = query.data === undefined ? undefined : select ? select(query.data) : query.data;

  return {
    data,
    isPending: query.isPending || (firestoreReady && query.data === undefined),
    subscriptionError,
    isUnavailable: !firestoreReady,
  };
}

/**
 * Replace a cache entry by hand.
 *
 * Used by mutations that already know their outcome, to avoid waiting for the
 * listener's round trip. Safe to be wrong about: the listener overwrites it
 * within a few hundred milliseconds, so a stale optimistic value corrects
 * itself rather than persisting.
 */
export function useCacheWrite<T>(queryKey: QueryKey) {
  const queryClient = useQueryClient();
  return (updater: T | ((current: T | undefined) => T)) =>
    queryClient.setQueryData<T>(queryKey, updater);
}
