# Firebase / Firestore reference

Authoritative notes on how Shield actually uses Firebase. Where this document and
the code disagree, the code is wrong — several entries below exist precisely
because the code and the schema drifted apart.

Related: [`architecture/DATABASE.md`](./architecture/DATABASE.md) (collection
inventory), [`architecture/FIRESTORE_MIGRATION.md`](./architecture/FIRESTORE_MIGRATION.md)
(why a Mongoose-shaped shim sits on top of the Admin SDK).

---

## 1. Architecture in one paragraph

Firestore has **two disjoint client zones**, and which one a given read belongs to
decides who is allowed to make it.

The server-owned schema (25 collections, §2) is written **only** by the Express
API through the Firebase **Admin** SDK, which bypasses `firestore.rules`
entirely. The mobile app reaches it over HTTPS and is refused by the rules if it
tries anything else.

Separately, `artifacts/mobile/lib/firestore/` models a second schema — the ERD —
which the mobile app *does* read and write directly with the Firestore **client**
SDK, scoped per user by `firestore.rules`. Its 14 collections are all prefixed
`mobile` (`mobileUsers`, `mobileDevices`, …) so they cannot collide with the
server's `users` / `devices`.

```
artifacts/mobile  ──HTTP/JSON──▶  server/  ──Admin SDK──▶  Firestore
        │                          (bypasses rules)      server-owned (25)
        │
        └──client SDK + ID token──▶ Firestore ──▶ mobile* collections (14)
                                     (rules enforced)   ERD-owned
```

The two write to disjoint paths. Anything already implemented server-side still
goes through the API; the `mobile*` set is the new path.

### Why the ERD is namespaced with a prefix, not a path

`mobile/users` is not a legal Firestore path. Paths alternate
collection/document, so a collection reference needs an **odd** number of
segments; `mobile/users` has two and the client SDK throws before any network
call:

```
Invalid collection reference. Collection references must have an odd number of
segments, but mobile/users has 2.
```

The phantom segment would also have to be a real document ID, since the segment
before a collection always is. So the namespace goes on the collection *name*,
which keeps every collection at one segment and every document at two. The same
constraint is why a REST test path like `mobile/devices/x` returns 400 rather
than 403: it is a malformed document name, rejected before rules are evaluated.
See the header of `artifacts/mobile/lib/firestore/schema.ts`.

### Realtime listeners

`onSnapshot` exists, but only inside the `mobile*` zone: `crud.subscribe()` in
`artifacts/mobile/lib/firestore/crud.ts`. Each one needs a matching `allow read`
grant, which is separate from `get`.

There are no listeners against the server-owned schema, and there should not be
one. A client-side connection to those collections would bypass every validator
in `server/src/validators/` and the ownership check in
`server/src/middleware/auth.middleware.ts`, and it would be refused by the rules
anyway. That half of the app polls through the API.

### What is *not* wired up

- **`dataconnect/`** — an unused scaffold. `dataconnect/schema/schema.gql`
  declares `User`, `Project`, `Milestone`, `Task` and `Comment`, a generic
  task-tracker shape with no relationship to Shield's collections. No route,
  service or test references it. Do not treat it as the schema.
- **Firebase Auth (server-side)** — the API does not use it. Authentication is a
  custom JWT (`signAccessToken` in `server/src/middleware/auth.middleware.ts`)
  with `refresh_tokens` in Firestore. The `mobile*` zone is different: it keys
  ownership on the Firebase uid, so those documents require a Firebase ID token.
- **Firebase Storage** — not configured.
- **Cloud Messaging** — not configured.

---

## 2. Collections

This section covers the **server-owned** schema only. The client-owned `mobile*`
schema is 14 further collections declared in
`artifacts/mobile/lib/firestore/schema.ts`; see §1.

26 logical keys in `server/src/db/schema.ts` map to **25 physical
collections**. `phishingChecks` and `webChecks` are both aliases of
`web_checks`; there is no `phishing_checks` collection, despite the constant
name. Anything that iterates `Object.values(COLLECTIONS)` will therefore see
`web_checks` twice, which is harmless for truncation but will double-count
unless de-duplicated.

`_id` always mirrors the Firestore document ID. `createdAt` / `updatedAt` are
stamped by the data layer, not by call sites.

### The `_schema` sentinel

`db:bootstrap` writes a document with id `_schema` into every collection
(`SCHEMA_MARKER_ID`). It exists to force collection creation and to give the
rules/index deployment something to attach to. **It is not data** — every read
path filters it, and the E2E helpers exclude it from counts. Any new query helper
must do the same or the sentinel will show up in user-facing lists.

---

## 3. The query layer

`server/src/db/queries.ts` is the sanctioned way to read and write. It exists
because the Mongoose-shaped model layer in `server/src/models/firestore.ts`
erases type information: every interface except `IUser` and
`IAppPermissionScan` was an empty `interface extends FirestoreModelDocument`,
which carries `[key: string]: any`. A typo in a field name, a `string` where a
`Date` was expected, or a filter on a field nothing ever writes all compiled
cleanly and failed only at runtime. The types in `db/schema.ts` are derived from
the actual create/update/filter/sort sites in `routes/`, `controllers/` and
`services/`.

| Helper | Purpose |
| --- | --- |
| `getCollection` / `getDocById` / `docExists` | single-collection access |
| `findOneBy` | first match |
| `listDocs` / `listDocsBy` | filtered, ordered, paginated lists |
| `countDocs` | `count()` — cheap, uses the index |
| `countDocsByScan` | scan fallback; avoid on large collections |
| `createDoc` / `updateDoc` / `upsertDoc` | single-document writes |
| `runBatch` | batched writes, **commits** |
| `deleteDoc` / `deleteWhere` | deletes |
| `encodeCursor` / `decodeCursor` | opaque keyset cursors |

### Cursor pagination

`encodeCursor` takes an **array of field values in sort order**, not a document
id, and tags `Date` / `Timestamp` values so `decodeCursor` can restore them.

`listDocs` appends an explicit `FieldPath.documentId()` ascending to every
non-empty `order`, and emits one cursor value per sort key. This is what makes
keyset pagination deterministic when the sort key has ties — Firestore otherwise
gives no ordering guarantee among equal values, so rows can be skipped or
repeated across pages.

Two consequences, both load-bearing:

- **Every composite index needs a trailing `__name__` entry.** All 55 indexes in
  `firestore.indexes.json` have one — 28 for the server schema, 27 for the
  `mobile*` zone. Deploy them before relying on cursor pagination in production:
  `firebase deploy --only firestore:indexes`.
- **A cursor from the old format is rejected, not misread.** `decodeCursor`
  returns `null` for a legacy 1-element cursor whose sort has more than one key,
  and `listDocs` then starts from the beginning. This is a breaking change for
  any client holding a cursor across a deploy.

Offset pagination (`skip`/`limit`) is still what the current routes use. The
cursor helpers are ready but not yet exposed over HTTP.

### Writes

- `stripUndefined` runs on every write path. Firestore rejects `undefined` as a
  value, and several call sites clear a field by assigning `undefined`.
  Dropping the key is *not* sufficient under `merge: true` — it leaves the
  stored value in place. To actually clear a field, the hydrated-document
  `save()` in `server/src/services/firestoreMigration.ts` translates `undefined`
  to `FieldValue.delete()`.
- `runBatch`'s callback may be `async` and the batch is committed for you.
  (It previously built a batch and never committed it, so every caller silently
  wrote nothing.)
- `docExists` reads a snapshot and checks `.exists`. `DocumentReference` has no
  `.exists()` method; the previous implementation called one and threw.

---

## 4. `select()` is a no-op — and why the API is still safe

`select()` in `firestoreMigration.ts` returns `this` and discards its argument.
It does **not** project fields. Several call sites use it as if it did:

```ts
PhishingCheck.find({ userId }).select("-encryptedUrl")  // does nothing
AuditLog.find(...).select("-detailsEncrypted")          // does nothing
```

Two of these are security-relevant, so it matters that they are not load-bearing:

- **`web_checks.encryptedUrl`** — client-supplied ciphertext the server cannot
  decrypt. Safe only because `controllers/webCheck.controller.ts` maps an
  explicit field allowlist before responding. Any handler that returns the raw
  hydrated document leaks it.
- **`audit_logs.detailsEncrypted`** — AES-256-GCM under `ENCRYPTION_KEY`.
  Safe only because `controllers/auditLog.controller.ts` maps an allowlist.

`audit.service.ts` additionally casts through `as unknown as Promise<IAuditLog[]>`
to hide the fact that the projection did not apply. Do not add a new
`select()`-based exclusion and assume it works — use an allowlist, and treat any
`select()` call as documentation of intent only.

There is also **no decryptor for `detailsEncrypted` anywhere in `src/`**. The
field is write-only. Any feature that needs to read audit details back has to add
one.

---

## 5. Known schema drift

Fields the API reads or projects but that **no code path ever writes**. Because
Firestore drops `undefined`, the stored document has no such key, and
`JSON.stringify` then omits it from the response — the client sees a missing
key where the OpenAPI spec promises a value.

### `users.role` and `users.protectionScore`

Never written. Every user therefore has `role === undefined`. `role` is typed
`UserRole`, and the OpenAPI spec lists it under `required`. Either seed it at
registration (see `SETTINGS_DEFAULTS` for the pattern) or delete the field from
the type and the spec. `protectionScore` is projected and always absent.

### Six `devices` fields

`simStatus`, `gpsPrecision`, `networkEncryption`, `isOnline`, `vpnEnabled` and
`theftProtectionEnabled` are projected by `controllers/devices.controller.ts`
and never written. `controllers/antitheft.controller.ts` papers over two of them
by hardcoding `"Unknown"`.

`devices.lastSeenAt` **was** in the same category and is now stamped on
registration. It is the primary sort key for every device list endpoint, so
leaving it unset made that ordering meaningless (Firestore sorts absent values
first) *and* 500'd `POST /api/devices`: `deviceView` called `.toISOString()` on
it unconditionally. See `src/utils/date.ts`.

### `companion_accounts.isActive` — fixed

`createCompanionAccount` never set `isActive`, and `loginCompanionAccount`
rejects with `forbidden` when it is falsy. Since Firestore drops `undefined`,
**every companion account created through the API was permanently unable to log
in** while the create call returned 201. The create path now sets
`isActive: true`. Regression coverage:
`server/test/companion-accounts.e2e.test.ts`.

### `theft_commands.issuedAt` and `expiresAt`

`issuedAt` is the sort key for `GET /api/theft/commands`, but only 1 of
the 4 creation paths sets it (the synchronous locate path at
`controllers/theft.controller.ts:66`). `expiresAt` is never written.

Listing queued commands used to 500 for the same reason `POST /api/devices` did;
the view now uses `isoOrNull`. The underlying omission is still there, so
`issuedAt` is `null` for commands created by the other three paths and the
ordering is not stable. Set it in all four paths.

### `2fa` seed is stored in plaintext

`users.twoFactorSecret` is an `otplib` base32 seed written by
`POST /api/auth/2fa/setup`. It is written in **plaintext** and must persist: it
is verified again on every login where 2FA is enabled
(`userService.login`), so it cannot be discarded at verification time. It is
cleared only by `POST /api/auth/2fa/disable`.

Anyone able to read the `users` collection can mint valid codes indefinitely.
`ENCRYPTION_KEY` and an AES-256-GCM helper already exist in
`services/audit.service.ts` and are the natural mechanism to close this. Not
changed here because it is a schema-and-migration decision, not a test fix.

### `threats` is a global feed

`GET /api/threats` performs **no ownership check** — `threats` rows are
advisories shared by all users. Intentional, and pinned by a test in
`server/test/data-flows.e2e.test.ts` so it stays a decision rather than an
oversight. Do not add a `userId` filter to it.

---

## 6. Data-layer type safety

`server/src/db/schema.ts` is the single source of truth for document shapes.
Two conventions matter when editing it:

- Fields marked *"never written"* in their doc comment are there because the code
  **reads** them. They are latent bugs, not schema. Do not "fix" the type to
  make them required without also writing them.
- `CollectionDocMap` must stay in sync with `COLLECTIONS`. The generic model
  factory in `models/firestore.ts` is keyed on it, so a mismatch surfaces as a
  type error at the model, not at the query.

A type is declared as `any`-free precisely so that a filter on an unwritten
field fails to compile. Keep it that way: a doc field with no write site is a
finding, not an inconvenience.

---

## 7. Running the E2E suite

```bash
cd server && npm run test:e2e      # or: bash ./test/run.sh
```

Requires **JDK 21+** — `firebase-tools` dropped support for Java < 21 and the
Firestore emulator is a JVM app. `run.sh` autodetects a JDK and prints install
instructions if it cannot find one; override with `JAVA_HOME`.

The suite runs against the Firestore emulator under project `demo-shield`
(`emulators:exec` owns the lifecycle). It is **API-level**, not browser-level:
it drives the real Express app in-process over HTTP and asserts against the
Admin SDK. There is no mobile UI coverage.

`test/helpers/env.ts` must be the first import in any test file. It hard-fails
unless `FIRESTORE_EMULATOR_HOST` is set and the project is `demo-shield`, so a
test cannot truncate a real project by accident.

| Suite | Covers |
| --- | --- |
| `smoke.test.ts` | health check, boot |
| `db-queries.test.ts` | the query layer against the emulator |
| `auth.e2e.test.ts` | register/login/refresh/logout, 2FA, password rules |
| `data-flows.e2e.test.ts` | devices, settings, security events, web checks, tenant isolation, persistence |
| `companion-accounts.e2e.test.ts` | companion create/login/sessions, isolation |
| `security-rules.e2e.test.ts` | rules boundary over the emulator's REST surface: server schema closed to clients, `mobile*` closed to anonymous callers |

`--test-concurrency=1` is deliberate: every suite truncates the shared emulator
first, so parallel files would delete each other's fixtures.

---

## 8. Deploying

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Deploy indexes before enabling cursor pagination in any client — a missing
trailing `__name__` entry makes the query fail rather than fall back to a scan.
