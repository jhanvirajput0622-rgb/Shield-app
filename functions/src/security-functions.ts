import { getApp, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";

initializeApp();

const db = getFirestore(getApp(), "shield");
const HIGH_SEVERITIES = new Set(["high", "critical"]);
const MAX_BATCH_SIZE = 500;
const CLEANUP_LIMIT = 10_000;

export const notifyHighSeveritySecurityEvent = onDocumentCreated(
  { document: "security_events/{eventId}", database: "shield" },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const securityEvent = snapshot.data();
    const userId = securityEvent["userId"];
    const severity = String(securityEvent["severity"] ?? "").toLowerCase();
    if (typeof userId !== "string" || !HIGH_SEVERITIES.has(severity)) return;

    const notificationRef = db.collection("notifications").doc(event.params.eventId);
    const notificationSnapshot = await notificationRef.get();
    if (notificationSnapshot.get("pushSentAt")) return;

    const deviceId = securityEvent["deviceId"];
    let devicesQuery = db.collection("devices").where("userId", "==", userId);
    if (typeof deviceId === "string" && deviceId.length > 0) {
      devicesQuery = devicesQuery.where("_id", "==", deviceId);
    }
    const devices = await devicesQuery.get();
    const tokenEntries = devices.docs
      .map((device) => ({ id: device.id, token: device.get("pushToken") }))
      .filter((entry): entry is { id: string; token: string } =>
        typeof entry.token === "string" && entry.token.length > 0
      );

    const title = typeof securityEvent["title"] === "string"
      ? securityEvent["title"]
      : "Shield security alert";
    const message = typeof securityEvent["description"] === "string"
      ? securityEvent["description"]
      : "A high-severity security event was detected.";

    await notificationRef.set({
      userId,
      isRead: false,
      title,
      message,
      type: "Alert",
      securityEventId: event.params.eventId,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    for (let offset = 0; offset < tokenEntries.length; offset += MAX_BATCH_SIZE) {
      const batch = tokenEntries.slice(offset, offset + MAX_BATCH_SIZE);
      const result = await getMessaging().sendEachForMulticast({
        tokens: batch.map((entry) => entry.token),
        notification: { title, body: message },
        data: { eventId: event.params.eventId, severity },
      });

      const invalidTokenUpdates = result.responses.flatMap((response, index) => {
        const code = response.error?.code;
        if (
          response.success ||
          (code !== "messaging/registration-token-not-registered" &&
            code !== "messaging/invalid-registration-token")
        ) return [];
        return [db.collection("devices").doc(batch[index].id).update({
          pushToken: FieldValue.delete(),
          pushTokenUpdatedAt: FieldValue.serverTimestamp(),
        })];
      });
      await Promise.all(invalidTokenUpdates);
    }

    await notificationRef.set({ pushSentAt: FieldValue.serverTimestamp() }, { merge: true });
  }
);

export const cleanupExpiredSecurityTokens = onSchedule(
  { schedule: "every 24 hours", timeZone: "UTC" },
  async () => {
    const now = Timestamp.now();
    const collections = [
      "refresh_tokens",
      "password_reset_tokens",
      "email_otp_challenges",
    ];

    for (const collectionName of collections) {
      let deleted = 0;
      while (deleted < CLEANUP_LIMIT) {
        const expired = await db.collection(collectionName)
          .where("expiresAt", "<", now)
          .limit(Math.min(MAX_BATCH_SIZE, CLEANUP_LIMIT - deleted))
          .get();
        if (expired.empty) break;

        const batch = db.batch();
        expired.docs.forEach((document) => batch.delete(document.ref));
        await batch.commit();
        deleted += expired.size;
        if (expired.size < MAX_BATCH_SIZE) break;
      }
    }
  }
);
