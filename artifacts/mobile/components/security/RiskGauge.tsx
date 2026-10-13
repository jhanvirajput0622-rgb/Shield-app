/**
 * RiskGauge — the phishing scan's 0–100 score.
 *
 * A bare number means nothing to anyone who does not already know the scale, and
 * a number plus a colour still leaves the interpretation implicit. So all three
 * are present: the figure, a meter showing where it sits, and the band's meaning
 * in words. The wording is the accessible part — the meter is plain Views, so it
 * carries no text of its own for a screen reader.
 *
 * A linear meter rather than a ring on purpose. The app already has `ShieldRing`
 * for rings, and a dial drawn from a rotated bordered circle does not actually
 * render an arc — it paints a stray border segment. A bar is unambiguous,
 * renders identically on web and native, and needs no `react-native-svg`.
 *
 * The band markers are drawn at the analyser real thresholds (25 / 55) so the
 * thresholds are visible rather than a hidden implementation detail. See
 * lib/phishing/riskEngine.ts.
 */

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import colors from "@/constants/colors";
import { riskColor } from "@/lib/utils";
import type { ScanResult } from "@/hooks/firestore/usePhishingScan";
import { RESULT_HEADLINE, RESULT_LABEL, RESULT_RISK } from "@/lib/phishing/riskEngine";

export interface RiskGaugeProps {
  /** 0–100. Values outside the range are clamped rather than trusted. */
  score: number;
  result: ScanResult;
  /** Shown under the score, e.g. the host that was checked. */
  caption?: string;
  /** The signals behind the score, listed beneath the meter. */
  signals?: { id: string; label: string }[];
}

/** Must match `verdictFor` in lib/phishing/riskEngine.ts. */
const BAND_STARTS = [25, 55, 75];

export function RiskGauge({ score, result, caption, signals = [] }: RiskGaugeProps) {
  const c = colors.dark;
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const tone = riskColor(RESULT_RISK[result]);

  return (
    <View style={styles.container}>
      <View style={styles.headRow}>
        <View style={styles.scoreBlock}>
          <Text style={[styles.score, { color: tone }]}>{clamped}</Text>
          <Text style={styles.scoreLabel}>/ 100</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${tone}18` }]}>
          <Feather
            name={
              result === "safe"
                ? "check-circle"
                : result === "unknown"
                  ? "help-circle"
                  : "alert-triangle"
            }
            size={14}
            color={tone}
          />
          <Text style={[styles.badgeText, { color: tone }]}>{RESULT_LABEL[result]}</Text>
        </View>
      </View>

      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${clamped}%`, backgroundColor: tone }]} />
        {BAND_STARTS.map((mark) => (
          <View key={mark} style={[styles.bandMark, { left: `${mark}%` }]} />
        ))}
      </View>

      <Text style={styles.headline}>{RESULT_HEADLINE[result]}</Text>

      {caption ? (
        <Text style={styles.caption} numberOfLines={2}>
          {caption}
        </Text>
      ) : null}

      {signals.length > 0 ? (
        <View style={styles.signalList}>
          {signals.map((signal) => (
            <View key={signal.id} style={styles.signalRow}>
              <Feather name="alert-circle" size={12} color={c.warning} />
              <Text style={styles.signalText}>{signal.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {result === "safe" ? (
        // The caveat the rest of the app is built around: a clean structural scan
        // is not a clean bill of health.
        <View style={styles.caveat}>
          <Feather name="info" size={12} color={c.textDisabled} />
          <Text style={styles.caveatText}>
            This checks the shape of the address only. It has no access to threat
            feeds or blocklists, so a clean result is not a guarantee.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const c = colors.dark;
const styles = StyleSheet.create({
  container: { gap: 12 },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  scoreBlock: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  score: { fontSize: 40, fontWeight: "800", lineHeight: 44 },
  scoreLabel: { fontSize: 12, color: c.mutedForeground },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: { fontSize: 13, fontWeight: "700" },
  meterTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: c.elevated,
    borderWidth: 1,
    borderColor: c.border,
    overflow: "hidden",
    justifyContent: "center",
  },
  meterFill: { height: "100%", borderRadius: 999 },
  bandMark: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: `${c.border}CC`,
  },
  headline: { fontSize: 13, fontWeight: "600", color: c.foreground, lineHeight: 18 },
  caption: { fontSize: 11, color: c.mutedForeground, fontFamily: "monospace" },
  signalList: { gap: 7 },
  signalRow: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  signalText: { flex: 1, fontSize: 12, color: c.mutedForeground, lineHeight: 17 },
  caveat: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    backgroundColor: c.elevated,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: c.border,
  },
  caveatText: { flex: 1, fontSize: 11, color: c.textDisabled, lineHeight: 16 },
});
