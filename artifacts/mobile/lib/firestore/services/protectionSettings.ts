/**
 * ERD entity 8 -- ProtectionSettings.
 *
 * Singleton per user: the document ID IS the uid, so the one-settings-per-user
 * rule is structural rather than a check. A second write to the same path
 * updates the existing row instead of creating a rival one, which is the usual
 * failure mode when settings are keyed by a generated ID.
 *
 * Reads go through `ensureProtectionSettings`, which creates the document with
 * `PROTECTION_SETTINGS_DEFAULTS` on first access. A bare `get` returns null for
 * a user who has never opened settings, so callers that assume the flags exist
 * would silently read `undefined` for all four booleans.
 */

import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";

import { crud, now } from "../crud";
import {
  COLLECTIONS,
  PROTECTION_SETTINGS_DEFAULTS,
  converterFor,
  type ProtectionSettingsDoc,
  type WithId,
} from "../schema";
import { getFirestoreDb } from "../../firebase";
import { requireUserId } from "./context";

const settingsCrud = crud("protectionSettings");

export type ProtectionSettingsPatch = Partial<
  Pick<
    ProtectionSettingsDoc,
    "biometricEnabled" | "autoLock" | "dataWipeEnabled" | "backupEnabled"
  >
>;

/** Raw read. Returns `null` when the user has never had settings written. */
export function getProtectionSettings(
  uid: string
): Promise<WithId<ProtectionSettingsDoc> | null> {
  return settingsCrud.get(uid);
}

/**
 * Read settings, creating them with defaults on first access.
 *
 * The create is unconditional rather than a transaction: two concurrent callers
 * both writing the same defaults produces the same document, and a transaction
 * would only add a read and a retry path for no benefit.
 */
export async function ensureProtectionSettings(): Promise<WithId<ProtectionSettingsDoc>> {
  const uid = requireUserId();

  const existing = await getDoc(
    doc(getFirestoreDb(), COLLECTIONS.protectionSettings, uid).withConverter(
      converterFor("protectionSettings")
    )
  );
  if (existing.exists()) return existing.data() as WithId<ProtectionSettingsDoc>;

  const data: ProtectionSettingsDoc = {
    userId: uid,
    ...PROTECTION_SETTINGS_DEFAULTS,
    createdAt: now(),
    updatedAt: now(),
  };
  // The converter is attached to the reference; `setDoc` ignores a `converter`
  // passed in its options object.
  await setDoc(
    doc(getFirestoreDb(), COLLECTIONS.protectionSettings, uid).withConverter(
      converterFor("protectionSettings")
    ),
    data
  );

  return { ...data, id: uid };
}

/** Patch one or more flags. Creates the document if it is missing. */
export async function updateProtectionSettings(
  patch: ProtectionSettingsPatch
): Promise<void> {
  const uid = requireUserId();
  await ensureProtectionSettings();
  await settingsCrud.update(uid, { ...patch, updatedAt: now() } as Partial<ProtectionSettingsDoc>);
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await updateProtectionSettings({ biometricEnabled: enabled });
}

export async function setAutoLock(enabled: boolean): Promise<void> {
  await updateProtectionSettings({ autoLock: enabled });
}

export async function setDataWipeEnabled(enabled: boolean): Promise<void> {
  await updateProtectionSettings({ dataWipeEnabled: enabled });
}

export async function setBackupEnabled(enabled: boolean): Promise<void> {
  await updateProtectionSettings({ backupEnabled: enabled });
}

/** Reset all four flags to defaults without discarding the creation date. */
export async function resetProtectionSettings(): Promise<void> {
  await updateProtectionSettings({ ...PROTECTION_SETTINGS_DEFAULTS });
}

export function subscribeToProtectionSettings(
  onNext: (settings: WithId<ProtectionSettingsDoc> | null) => void,
  onError?: (error: Error) => void
): () => void {
  const uid = requireUserId();
  return onSnapshot(
    doc(getFirestoreDb(), COLLECTIONS.protectionSettings, uid),
    (snap) =>
      onNext(
        snap.exists()
          ? ({
              ...(snap.data() as ProtectionSettingsDoc),
              id: snap.id,
            } as WithId<ProtectionSettingsDoc>)
          : null
      ),
    (error) => onError?.(error)
  );
}
