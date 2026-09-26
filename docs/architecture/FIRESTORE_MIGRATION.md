# Firestore persistence

The backend uses Firebase Firestore. The Firebase Admin SDK is initialized in `server/src/config/firestore.ts`, and all server models are backed by the Firestore adapter in `server/src/services/firestoreMigration.ts`.

## Configuration

Set `FIREBASE_PROJECT_ID` and authenticate the server with Google Application Default Credentials or `GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json`. Never commit service-account credentials.

`GET /api/health` reports Firestore readiness through `databaseStatus` and returns `database: "Firestore"`.

To create the collection markers in a new project, run `cd server && npm run db:bootstrap`. Firestore creates collections when their first document is written; the bootstrap command writes a `_schema` marker that the application query adapter ignores.

The `mongodb://...firestore.goog` URL is for Firestore Enterprise's MongoDB compatibility API. It is not accepted by the Firebase Admin Firestore SDK used here, and it must not be placed in `FIREBASE_PROJECT_ID` or committed to the repository. Use the Firebase project ID plus Application Default Credentials or `GOOGLE_APPLICATION_CREDENTIALS` for this server.

## Design

- Firestore document IDs are strings and replace Mongo ObjectIds.
- Existing service/controller CRUD semantics are preserved behind `FirestoreModel`.
- Query filtering supports the equality, `$in`, and `$ne` predicates currently used by the API.
- Sorting, pagination, counts, `updateMany`, `bulkWrite`, upserts, and deletes are implemented in the adapter.
- Server timestamps are written as JavaScript dates and normalized when documents are read.
- TTL cleanup must be scheduled separately because Firestore has no Mongo TTL index equivalent.
