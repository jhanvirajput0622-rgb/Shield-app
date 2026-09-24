import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { logger } from "../utils/logger";

// Import all models to ensure schemas are registered
import "../models/User";
import "../models/Device";
import "../models/UserKey";
import "../models/VpnSession";
import "../models/PhishingCheck";
import "../models/Threat";
import "../models/AntiTheftLog";
import "../models/AntiTheftCommand";
import "../models/PermissionScan";
import "../models/InstalledApp";
import "../models/AppPermission";
import "../models/Notification";
import "../models/AuditLog";
import "../models/CompanionAccount";
import "../models/CompanionSession";
import "../models/UserSetting";
import "../models/Settings";
import "../models/RefreshToken";
import "../models/PasswordResetToken";
import "../models/SecurityEvent";
import "../models/DeviceLocation";
import "../models/TheftCommand";
import "../models/WifiNetwork";
import "../models/AppPermissionScan";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function initDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    logger.error("MONGODB_URI environment variable is missing.");
    process.exit(1);
  }

  const dbName = process.env.MONGODB_DATABASE_NAME ?? "shield";

  try {
    logger.info(`Connecting to MongoDB Atlas (database: ${dbName})...`);
    await mongoose.connect(uri, {
      dbName,
    });
    
    logger.info("Successfully connected to MongoDB.");
    logger.info("Ensuring all collections and indexes are created...");

    // Sync all indexes (this creates collections implicitly if they don't exist)
    const models = mongoose.models;
    for (const modelName of Object.keys(models)) {
      const model = models[modelName];
      logger.info(`Syncing indexes for collection: ${model.collection.name}`);
      await model.syncIndexes();
    }

    logger.info("Database initialization complete.");
  } catch (error) {
    logger.error("Database initialization failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logger.info("Disconnected from MongoDB.");
    process.exit(0);
  }
}

initDatabase();
