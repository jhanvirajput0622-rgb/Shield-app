/**
 * VPN server catalogue.
 *
 * ── Why this is a static list and not discovered ──────────────────────────────
 * `VPNConnectionDoc` records `serverLocation` and `ipAddress` for a tunnel that
 * was actually established. Nothing in the ERD models the fleet, and there is no
 * endpoint that enumerates servers, so the picker needs a source. A static list
 * keeps the dashboard renderable; a real deployment would replace this module
 * with a fetch and leave the rest of the app untouched.
 *
 * ── On `exitIp` ───────────────────────────────────────────────────────────────
 * These are the addresses each server advertises, the way a real VPN provider
 * publishes its shared egress ranges. They are NOT probed from the device, and
 * the UI does not claim otherwise — see the label in VpnServerCard. A tunnel
 * that a real transport established would carry the address the transport
 * actually assigned; that plumbing is what `assignExitIp` is the seam for.
 */

export interface VpnServer {
  /** Stable id, and the value persisted as `serverLocation`. */
  id: string;
  city: string;
  country: string;
  countryCode: string;
  flag: string;
  /** Load estimate, 0–100. Lower is better. */
  load: number;
  /** Advertised shared egress address for this location. */
  exitIp: string;
  /** Human-readable latency estimate, not a measured value. */
  latencyLabel: string;
  /** Marks the sponsor/priority tier. */
  featured: boolean;
}

export const VPN_SERVERS: VpnServer[] = [
  {
    id: "us-east-1",
    city: "New York",
    country: "United States",
    countryCode: "US",
    flag: "🇺🇸",
    load: 24,
    exitIp: "10.8.0.2",
    latencyLabel: "12 ms",
    featured: true,
  },
  {
    id: "us-west-2",
    city: "Seattle",
    country: "United States",
    countryCode: "US",
    flag: "🇺🇸",
    load: 18,
    exitIp: "10.8.0.6",
    latencyLabel: "34 ms",
    featured: false,
  },
  {
    id: "uk-south-1",
    city: "London",
    country: "United Kingdom",
    countryCode: "GB",
    flag: "🇬🇧",
    load: 41,
    exitIp: "10.8.1.4",
    latencyLabel: "78 ms",
    featured: true,
  },
  {
    id: "de-central-1",
    city: "Frankfurt",
    country: "Germany",
    countryCode: "DE",
    flag: "🇩🇪",
    load: 33,
    exitIp: "10.8.1.8",
    latencyLabel: "92 ms",
    featured: false,
  },
  {
    id: "sg-southeast-1",
    city: "Singapore",
    country: "Singapore",
    countryCode: "SG",
    flag: "🇸🇬",
    load: 55,
    exitIp: "10.8.2.2",
    latencyLabel: "164 ms",
    featured: false,
  },
  {
    id: "jp-northeast-1",
    city: "Tokyo",
    country: "Japan",
    countryCode: "JP",
    flag: "🇯🇵",
    load: 29,
    exitIp: "10.8.2.6",
    latencyLabel: "148 ms",
    featured: false,
  },
  {
    id: "au-southeast-2",
    city: "Sydney",
    country: "Australia",
    countryCode: "AU",
    flag: "🇦🇺",
    load: 22,
    exitIp: "10.8.3.2",
    latencyLabel: "196 ms",
    featured: false,
  },
  {
    id: "in-south-1",
    city: "Mumbai",
    country: "India",
    countryCode: "IN",
    flag: "🇮🇳",
    load: 64,
    exitIp: "10.8.3.6",
    latencyLabel: "182 ms",
    featured: false,
  },
];

/** The server shown before the user picks one. */
export const DEFAULT_VPN_SERVER_ID = "us-east-1";

export function getServer(serverId: string | null | undefined): VpnServer | null {
  if (!serverId) return null;
  return VPN_SERVERS.find((server) => server.id === serverId) ?? null;
}

/**
 * Best current pick for a user who has not chosen: the least loaded featured
 * server, so the default is not the slowest link.
 */
export function recommendedServer(): VpnServer {
  const featured = VPN_SERVERS.filter((server) => server.featured);
  const pool = featured.length > 0 ? featured : VPN_SERVERS;
  return pool.reduce((best, server) => (server.load < best.load ? server : best), pool[0]);
}
