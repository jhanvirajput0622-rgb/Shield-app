/**
 * Protection tab — Shield.
 *
 * The dedicated Protection screen hosts the Web Protection module as its sole
 * module. The remaining modules live behind their own destinations:
 *   - App Permissions  → /app (tab)
 *   - Network Security → /network
 *   - Anti-Theft       → /antitheft
 * and are surfaced as status cards on the Dashboard overview.
 */
import React from "react";
import WebProtectionScreen from "@/components/WebProtectionScreen";

export default function ProtectionScreen() {
  return <WebProtectionScreen inTabs />;
}