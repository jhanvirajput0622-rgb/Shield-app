/**
 * Serialises a Firestore date-ish value for an API response.
 *
 * Why this exists: `db/queries.ts` revives `Timestamp` -> `Date` on read, so most
 * view builders receive a real `Date` and `.toISOString()` works. It breaks in
 * three ways, all of which are reachable in production:
 *
 *  1. The field is optional in `db/schema.ts` and was never written, e.g.
 *     `DeviceDoc.lastSeenAt` is absent until the device reports in. Calling
 *     `.toISOString()` on it throws a TypeError, which the error handler turns
 *     into a 500. This is why `POST /api/devices` used to fail for every newly
 *     registered device.
 *  2. A create path omits the field the sort key depends on, e.g.
 *     `TheftCommandDoc.issuedAt` is unset by 3 of 4 creation paths, so listing
 *     queued commands threw.
 *  3. A `Timestamp` reaches a view builder that was handed a raw Admin SDK
 *     document, bypassing `reviveDates`.
 *
 * Returns `null` for absent values so the JSON contract stays stable and the
 * mobile client can distinguish "never happened" from a real timestamp.
 */

/** Firestore `Timestamp` shape; structurally typed to avoid an Admin import. */
interface TimestampLike {
  toDate(): Date;
  seconds?: number;
}

function isTimestampLike(value: unknown): value is TimestampLike {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as TimestampLike).toDate === "function"
  );
}

/**
 * Normalise `Date | Timestamp | string | number | null | undefined` to an ISO
 * 8601 string, or `null` when the value is absent or unparseable.
 */
export function isoOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (isTimestampLike(value)) {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  return null;
}
