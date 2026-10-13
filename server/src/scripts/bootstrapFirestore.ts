import "dotenv/config";
import { bootstrapFirestoreCollections, firestoreCollectionMap } from "../services/firestoreMigration";

async function main(): Promise<void> {
  await bootstrapFirestoreCollections();
  const collections = [...new Set(Object.values(firestoreCollectionMap))];
  console.log(`Initialized ${collections.length} Firestore collections for project ${process.env.FIREBASE_PROJECT_ID ?? "from runtime credentials"}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});