/**
 * ERD entity 8 — ProtectionSettings, exposed to the UI.
 *
 * Wraps `lib/firestore/services/protectionSettings` and adds the behaviour the
 * raw service deliberately leaves out:
 *
 *  - **Realtime.** Backed by `subscribeToProtectionSettings`, so a change made
 *    on another device (or by the server) updates the toggle here without a
 *    pull-to-refresh. The document is created with the ERD defaults on first
 *    access, so there is no "settings do not exist yet" state to represent.
 *
 *  - **Optimistic toggles with rollback.** A `Switch` feels broken if the thumb
 *    waits for a network round trip, and worse, it looks *ignored* when it snaps
 *    back. The cache is updated immediately, the write is issued, and a failure
 *    restores the previous value and surfaces the reason.
 *
 *  - **A biometric gate on the two sensitive flags.** `dataWipeEnabled` and
 *    `backupEnabled` are the toggles whose misuse costs a user their data. This
 *    is a UI affordance, not a security boundary — anything with code execution
 *    can call the service directly — so it must not be described as protection.
 *    It exists to stop a mis-tap.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";

import { protectionSettings, type ProtectionSettingsDoc, type WithId } from "@/lib/firestore";
import { useRealtimeQuery } from "./useRealtimeQuery";

export type { ProtectionSettingsDoc };
export type ProtectionSettings = WithId<ProtectionSettingsDoc>;

export const PROTECTION_SETTINGS_QUERY_KEY = ["firestore", "protectionSettings"] as const;

/** The four flags, in the order the ERD declares them. */
export const PROTECTION_FLAGS = [
  "biometricEnabled",
  "autoLock",
  "dataWipeEnabled",
  "backupEnabled",
] as const;

export type ProtectionFlag = (typeof PROTECTION_FLAGS)[number];

export interface ProtectionFlagMeta {
  key: ProtectionFlag;
  label: string;
  description: string;
  icon: "lock" | "clock" | "trash-2" | "database";
  /**
   * Requires a biometric check before it can be switched on. See the note at the
   * top of this file about what this does and does not protect against.
   */
  requiresBiometric: boolean;
  /** Enabling this arms data-destroying behaviour, so the UI warns first. */
  destructiveWhenEnabled: boolean;
}

export const PROTECTION_FLAG_META: Record<ProtectionFlag, ProtectionFlagMeta> = {
  biometricEnabled: {
    key: "biometricEnabled",
    label: "Biometric Lock",
    description: "Require fingerprint or face to open Shield.",
    icon: "lock",
    requiresBiometric: false,
    destructiveWhenEnabled: false,
  },
  autoLock: {
    key: "autoLock",
    label: "Auto-Lock",
    description: "Lock the app automatically when it goes to the background.",
    icon: "clock",
    requiresBiometric: false,
    destructiveWhenEnabled: false,
  },
  dataWipeEnabled: {
    key: "dataWipeEnabled",
    label: "Remote Data Wipe",
    description: "Erase app data if this device is marked as stolen.",
    icon: "trash-2",
    requiresBiometric: true,
    destructiveWhenEnabled: true,
  },
  backupEnabled: {
    key: "backupEnabled",
    label: "Encrypted Backup",
    description: "Back up protection settings to your Shield account.",
    icon: "database",
    requiresBiometric: true,
    destructiveWhenEnabled: false,
  },
};

/** Mirrors `PROTECTION_SETTINGS_DEFAULTS` in lib/firestore/schema.ts. */
export const PROTECTION_FLAG_DEFAULTS: Record<ProtectionFlag, boolean> = {
  biometricEnabled: false,
  autoLock: true,
  dataWipeEnabled: false,
  backupEnabled: true,
};

/**
 * Prompt for biometrics, degrading to a passcode and then to success.
 *
 * The permissive fallbacks are deliberate and worth being explicit about: on a
 * device with no biometric hardware, or nothing enrolled, there is nothing to
 * check against, and blocking the user out of a setting they are entitled to
 * change would be worse than proceeding. Where hardware *is* enrolled, a
 * cancelled or failed prompt returns false, so the gate is real.
 */
async function requestBiometricAuth(reason: string): Promise<boolean> {
  if (Platform.OS === "web") return true;
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return true;

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) return true;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      fallbackLabel: "Use Passcode",
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return true;
  }
}

export interface UseProtectionSettingsResult {
  settings: ProtectionSettings | null;
  /** Never null: falls back to the ERD defaults while loading or on failure. */
  flags: Record<ProtectionFlag, boolean>;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  /** True when a device with enrolled biometrics could verify the user. */
  biometricsAvailable: boolean;
  isPending: boolean;
  /** Set when a toggle was refused by the biometric gate. */
  blockedFlag: ProtectionFlag | null;
  toggle: (flag: ProtectionFlag, value: boolean) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  dismissBlocked: () => void;
}

export function useProtectionSettings(): UseProtectionSettingsResult {
  const queryClient = useQueryClient();
  const [blockedFlag, setBlockedFlag] = useState<ProtectionFlag | null>(null);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);

  const realtime = useRealtimeQuery<ProtectionSettings | null>({
    queryKey: PROTECTION_SETTINGS_QUERY_KEY,
    subscribe: ({ onData, onError }) => {
      // Materialise the document before listening. Without this the first
      // snapshot is `null` for a user who has never opened settings, and the
      // four booleans would all read `undefined` — the exact failure the
      // `ensureProtectionSettings` header warns about.
      let unsubscribe: (() => void) | null = null;
      let cancelled = false;

      void protectionSettings
        .ensureProtectionSettings()
        .catch((error: unknown) => {
          // A permissions rejection will be reported again by the listener
          // below, so do not duplicate it into two error channels.
          if (!cancelled) onError(error as Error);
        })
        .then(() => {
          if (cancelled) return;
          unsubscribe = protectionSettings.subscribeToProtectionSettings(onData, onError);
        });

      return () => {
        cancelled = true;
        unsubscribe?.();
      };
    },
  });

  // Feature-detect once per mount so the UI can explain *why* the biometric gate
  // did or did not fire, instead of silently allowing a sensitive toggle.
  useEffect(() => {
    if (Platform.OS === "web") {
      setBiometricsAvailable(false);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const [hasHardware, isEnrolled] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ]);
        if (active) setBiometricsAvailable(hasHardware && isEnrolled);
      } catch {
        if (active) setBiometricsAvailable(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const mutation = useMutation({
    mutationFn: (patch: Partial<Record<ProtectionFlag, boolean>>) =>
      protectionSettings.updateProtectionSettings(patch),

    // Optimistic: write the intent to the cache so the Switch tracks the finger,
    // then let the listener's next snapshot confirm or correct it.
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: PROTECTION_SETTINGS_QUERY_KEY });
      const previous = queryClient.getQueryData<ProtectionSettings | null>(
        PROTECTION_SETTINGS_QUERY_KEY
      );
      queryClient.setQueryData<ProtectionSettings | null>(PROTECTION_SETTINGS_QUERY_KEY, (current) => {
        const base = current ?? previous;
        if (!base) return current;
        return { ...base, ...patch };
      });
      return { previous };
    },
    onError: (_error, _patch, context) => {
      // Put the thumb back where it was, so the control never disagrees with the
      // stored truth.
      if (context?.previous) {
        queryClient.setQueryData(PROTECTION_SETTINGS_QUERY_KEY, context.previous);
      }
    },
  });

  const toggle = useCallback(
    async (flag: ProtectionFlag, value: boolean) => {
      const meta = PROTECTION_FLAG_META[flag];

      // Gate only on the way *into* a sensitive state. Requiring a biometric to
      // turn a protection back off would trap a user who enabled it in error.
      if (value && meta.requiresBiometric && biometricsAvailable) {
        const passed = await requestBiometricAuth(
          meta.key === "dataWipeEnabled"
            ? "Authenticate to enable remote data wipe"
            : `Authenticate to change "${meta.label}"`
        );
        if (!passed) {
          setBlockedFlag(flag);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return;
        }
      }

      setBlockedFlag(null);
      void Haptics.selectionAsync();
      await mutation.mutateAsync({ [flag]: value });
    },
    [biometricsAvailable, mutation]
  );

  const resetToDefaults = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await mutation.mutateAsync({ ...PROTECTION_FLAG_DEFAULTS });
  }, [mutation]);

  const settings = realtime.data ?? null;
  const flags = useMemo(() => {
    const source = settings ?? PROTECTION_FLAG_DEFAULTS;
    return {
      biometricEnabled: source.biometricEnabled,
      autoLock: source.autoLock,
      dataWipeEnabled: source.dataWipeEnabled,
      backupEnabled: source.backupEnabled,
    };
  }, [settings]);

  return {
    settings,
    flags,
    isLoading: realtime.isPending,
    isError: realtime.subscriptionError !== null,
    error: realtime.subscriptionError,
    biometricsAvailable,
    isPending: mutation.isPending,
    blockedFlag,
    toggle,
    resetToDefaults,
    dismissBlocked: () => setBlockedFlag(null),
  };
}
