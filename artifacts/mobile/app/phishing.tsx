/**
 * Web Protection — Shield.
 *
 * Stack entry for the Web Protection module. The Protection tab renders the
 * same screen (see (tabs)/protection.tsx) so the module stays available from
 * both the tab bar and the dashboard overview.
 */
import React from "react";
import WebProtectionScreen from "@/components/WebProtectionScreen";

export default function PhishingScreen() {
  return <WebProtectionScreen />;
}