import colors from "@/constants/colors";

export type RiskLevel =
  | "safe"
  | "low"
  | "medium"
  | "high"
  | "critical"
  | "warning"
  | "danger"
  | "unknown";

/** Map a risk level string to the Shield palette color. */
export function riskColor(level: RiskLevel | string): string {
  switch (level) {
    case "safe":
    case "low":
      return colors.dark.safe;
    case "medium":
    case "warning":
      return colors.dark.warning;
    case "high":
    case "danger":
      return colors.dark.danger;
    case "critical":
      return colors.dark.critical;
    default:
      return colors.dark.mutedForeground;
  }
}

/** 15%-opacity background for StatusPill. */
export function riskBgColor(level: RiskLevel | string): string {
  switch (level) {
    case "safe":
    case "low":
      return "rgba(52,211,153,0.15)";
    case "medium":
    case "warning":
      return "rgba(251,191,36,0.15)";
    case "high":
    case "danger":
      return "rgba(248,113,113,0.15)";
    case "critical":
      return "rgba(239,68,68,0.15)";
    default:
      return "rgba(147,161,176,0.15)";
  }
}

/** Format an ISO timestamp as a human-friendly relative time. */
export function timeAgo(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/** Map overall protection status to a display color. */
export function overallStatusColor(status: string): string {
  switch (status) {
    case "protected":
    case "safe":
      return colors.dark.safe;
    case "action_needed":
    case "warning":
      return colors.dark.warning;
    case "at_risk":
    case "danger":
    case "critical":
      return colors.dark.critical;
    default:
      return colors.dark.safe; // default to safe — green is a better UX default than grey
  }
}

/** Map overall protection status to a display label. */
export function overallStatusLabel(status: string): string {
  switch (status) {
    case "protected":
    case "safe":
      return "Protected";
    case "action_needed":
    case "warning":
      return "Action Needed";
    case "at_risk":
    case "danger":
    case "critical":
      return "At Risk";
    default:
      return "Protected"; // default to Protected rather than "Unknown"
  }
}

/** Generate a simple non-UUID id (safe on iOS/Android — no crypto.getRandomValues needed). */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}
