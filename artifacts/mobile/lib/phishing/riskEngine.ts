/**
 * Client-side URL risk scoring.
 *
 * ── What this is, and what it is not ──────────────────────────────────────────
 * This is a **heuristic structural analyser**. It reads the URL and scores the
 * things that are visible in the string itself: an IP literal instead of a
 * hostname, a punycode label, a brand name in the subdomain, a credential in the
 * userinfo section. It has no access to blocklists, threat feeds, WHOIS age, or
 * anything the server knows.
 *
 * So a low score means "nothing suspicious in the shape of this URL", NOT "this
 * URL is safe". A freshly registered lookalike domain with a valid certificate
 * and a clean structure scores low here and is still a phishing page. The UI
 * copy says exactly that, and the ERD's `ScanResult` has an `unknown` value for
 * the cases the analyser cannot reach a verdict on — it is used rather than
 * defaulting to `safe`, per the "never default to a false sense of safety" rule
 * the rest of the app follows.
 *
 * The design target is Google Safe Browsing's: block on strong signals, warn on
 * ambiguous ones, and stay out of the way otherwise. Over-eager scoring on a
 * security app trains users to dismiss the warnings that matter.
 *
 * ── Scoring model ─────────────────────────────────────────────────────────────
 * Signals are additive with a capped total, then mapped to a verdict:
 *
 *   0–24  safe         nothing worth flagging
 *   25–54 suspicious   something is off, not conclusive
 *   55–74 dangerous    strong phishing structure
 *   75–100 malicious   multiple hard indicators, or a confirmed hostile pattern
 *
 * `ParseFailure` short-circuits to `unknown` with score 0 — an unparseable input
 * must never render as safe.
 */

import type { ScanResult } from "@/lib/firestore/schema";

export interface RiskSignal {
  /** Stable id, used as a list key and in tests. */
  id: string;
  /** Shown to the user. Must state the observation, not the conclusion. */
  label: string;
  weight: number;
}

export interface RiskAssessment {
  /** 0–100. Always an integer. */
  score: number;
  result: ScanResult;
  signals: RiskSignal[];
  /** Hostname only, for display. Null when the input did not parse. */
  domain: string | null;
  /** Set when the input could not be assessed at all. */
  parseError: string | null;
  /** True when a rule matched with certainty rather than probabilistically. */
  hasHardIndicator: boolean;
}

/**
 * Brands whose presence in a *subdomain* is a strong phishing signal, because
 * the registrable domain is then something else. `paypal.com.secure-login.xyz`
 * contains "paypal" and resolves to `*.xyz`.
 */
const IMPERSONATED_BRANDS = [
  "paypal",
  "apple",
  "icloud",
  "microsoft",
  "google",
  "netflix",
  "facebook",
  "instagram",
  "whatsapp",
  "amazon",
  "coinbase",
  "binance",
  "metamask",
  "blockchain",
  "chase",
  "wellsfargo",
  "barclays",
  "santander",
  "hsbc",
  "dhl",
  "fedex",
  "ups",
  "usps",
  "royalmail",
  "dropbox",
  "github",
  "steam",
  "disney",
  "spotify",
];

/** Words that pair with a brand to form the promise the page is faking. */
const CREDENTIAL_BAIT = [
  "login",
  "signin",
  "sign-in",
  "log-in",
  "verify",
  "verification",
  "secure",
  "security",
  "account",
  "update",
  "confirm",
  "authenticate",
  "unlock",
  "suspended",
  "billing",
  "payment",
  "recover",
  "password",
  "wallet",
];

/** TLDs over-represented in abuse. Additive, not exhaustive. */
const RISKY_TLDS = new Set([
  "zip",
  "mov",
  "tk",
  "ml",
  "ga",
  "cf",
  "gq",
  "top",
  "xyz",
  "click",
  "link",
  "work",
  "rest",
  "country",
  "kim",
  "loan",
  "download",
  "racing",
  "stream",
  "party",
  "date",
  "faith",
  "review",
  "trade",
  "win",
  "bid",
  "science",
  "gdn",
  "cam",
  "quest",
]);

/** URL shorteners that hide the real destination. */
const SHORTENERS = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "adf.ly",
  "bit.do",
  "cutt.ly",
  "rb.gy",
  "shorturl.at",
  "rebrand.ly",
  "tiny.cc",
]);

/** Schemes that are never a legitimate destination for a link check. */
const DANGEROUS_SCHEMES = new Set([
  "javascript:",
  "data:",
  "file:",
  "content:",
  "intent:",
]);

/** Hostname labels that indicate a raw IP was used instead of a domain. */
function isIpLiteral(host: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  // IPv6, e.g. [::1] or [2001:db8::1]
  return /^\[?[0-9a-f:]+\]?$/i.test(host) && host.includes(":");
}

/**
 * True for a punycode (`xn--`) label, which is how an IDN homograph is encoded.
 * The visual confusion only happens in a font, so this is a high-precision signal.
 */
function isPunycode(host: string): boolean {
  return host.split(".").some((label) => label.toLowerCase().startsWith("xn--"));
}

function baseScore(signals: RiskSignal[]): number {
  // Additive, but damped: eight weak signals should not reach "malicious". The
  // soft cap keeps a long tail of trivia in the "suspicious" band where it
  // belongs, leaving the top band for hard indicators.
  const total = signals.reduce((sum, signal) => sum + signal.weight, 0);
  return Math.min(100, Math.round(Math.sqrt(total) * 12));
}

function verdictFor(score: number, hard: boolean): ScanResult {
  if (hard) return "malicious";
  if (score >= 55) return "malicious";
  if (score >= 25) return "suspicious";
  return "safe";
}

/**
 * Score a URL.
 *
 * Pure and synchronous by design: it is called on every keystroke-commit from the
 * scan screen and must not hit the network, so it can be reasoned about and
 * tested without a device. Returns `unknown` rather than throwing on bad input.
 */
export function assessUrl(input: string): RiskAssessment {
  const raw = input.trim();

  if (!raw) {
    return {
      score: 0,
      result: "unknown",
      signals: [],
      domain: null,
      parseError: "Enter a URL to check.",
      hasHardIndicator: false,
    };
  }

  // A bare host like "example.com" is what users actually type. Assume https so
  // the absence of a scheme is not itself scored as plaintext — otherwise every
  // reasonable input looks suspicious.
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return {
      score: 0,
      result: "unknown",
      signals: [],
      domain: null,
      parseError: "That does not look like a valid URL.",
      hasHardIndicator: false,
    };
  }

  const scheme = url.protocol.replace(":", "").toLowerCase();
  const host = url.hostname.toLowerCase();
  const userinfo = url.username ? `${url.username}${url.password ? `:${url.password}` : ""}` : "";
  const signals: RiskSignal[] = [];
  let hard = false;

  // ── Hard indicators: a known-hostile construct, not a shape to be suspicious of.
  if (DANGEROUS_SCHEMES.has(scheme)) {
    signals.push({
      id: "scheme-hostile",
      label: `Uses the "${scheme}:" scheme, which can execute code or read local data`,
      weight: 100,
    });
    hard = true;
  } else if (scheme !== "https" && scheme !== "http") {
    signals.push({
      id: "scheme-unknown",
      label: `Unusual scheme "${scheme}:" — not a web address`,
      weight: 70,
    });
    hard = true;
  }

  if (isIpLiteral(host)) {
    signals.push({
      id: "ip-literal",
      label: "Points at a raw IP address rather than a named domain",
      weight: 55,
    });
    hard = true;
  }

  if (isPunycode(host)) {
    signals.push({
      id: "punycode",
      label: "Uses internationalised characters that can imitate a familiar domain",
      weight: 60,
    });
    hard = true;
  }

  if (userinfo) {
    signals.push({
      id: "userinfo",
      label: "Carries a username or password in the address itself",
      weight: 75,
    });
    hard = true;
  }

  if (SHORTENERS.has(host)) {
    signals.push({
      id: "shortener",
      label: "Shortened link — the real destination is hidden",
      weight: 40,
    });
  }

  // ── Structural signals: each is a reason to look harder, not a verdict.
  if (scheme === "http") {
    signals.push({
      id: "no-tls",
      label: "Not encrypted (http://) — anything sent is readable in transit",
      weight: 20,
    });
  }

  const labels = host.split(".").filter(Boolean);
  const tld = labels[labels.length - 1] ?? "";
  // Two labels is a registrable domain ("example.co.uk" is three, so this
  // errs toward flagging a few legitimate multi-part TLDs — accepted, because
  // the signal is damped and only ever produces a warning).
  const isBareDomain = labels.length <= 2;

  if (isBareDomain && !isIpLiteral(host)) {
    signals.push({
      id: "no-subdomain",
      label: "No subdomain — the domain itself is the destination",
      weight: 12,
    });
  }

  if (RISKY_TLDS.has(tld)) {
    signals.push({
      id: "risky-tld",
      label: `".${tld}" is heavily abused for phishing`,
      weight: 30,
    });
  }

  if (labels.length >= 4) {
    signals.push({
      id: "deep-subdomain",
      label: `Deeply nested subdomain (${labels.length} levels)`,
      weight: 20,
    });
  }

  const subdomain = labels.slice(0, -2).join(".");
  const brandHit = IMPERSONATED_BRANDS.find(
    (brand) => subdomain.includes(brand) || host.includes(`${brand}-`)
  );
  if (brandHit && isBareDomain) {
    signals.push({
      id: "brand-impersonation",
      label: `Mentions "${brandHit}" but the domain is ".${tld}" — a known brand, wrong owner`,
      weight: 65,
    });
    hard = true;
  }

  const hostWords = host.replace(/[^a-z0-9.]/gi, " ").toLowerCase();
  const baitHit = CREDENTIAL_BAIT.find((word) => hostWords.includes(word));
  if (baitHit) {
    signals.push({
      id: "credential-bait",
      label: `Asks you to "${baitHit}" — sign-in prompts are the point of a phishing page`,
      weight: 30,
    });
  }

  const hyphens = (host.match(/-/g) ?? []).length;
  if (hyphens >= 3) {
    signals.push({
      id: "hyphen-stuffing",
      label: "Domain is padded with hyphens to read like a real service",
      weight: 20,
    });
  }

  const digits = (host.match(/\d/g) ?? []).length;
  if (digits >= 4) {
    signals.push({
      id: "digit-stuffing",
      label: "Unusually many digits in the domain",
      weight: 15,
    });
  }

  const queryKeys = Array.from(url.searchParams.keys());
  if (queryKeys.some((key) => /^(redirect|next|return|dest|destination|url|continue|data|token)$/i.test(key))) {
    signals.push({
      id: "redirect-param",
      label: "Carries a redirect parameter — the real destination may differ",
      weight: 30,
    });
  }

  if (raw.length > 200) {
    signals.push({
      id: "long-url",
      label: "Unusually long address, often used to push the real host out of view",
      weight: 15,
    });
  }

  if (url.port && url.port !== "80" && url.port !== "443") {
    signals.push({
      id: "odd-port",
      label: `Non-standard port (${url.port})`,
      weight: 15,
    });
  }

  const score = baseScore(signals);
  return {
    score,
    result: verdictFor(score, hard),
    signals: signals.sort((a, b) => b.weight - a.weight),
    domain: host,
    parseError: null,
    hasHardIndicator: hard,
  };
}

/** Short label for a verdict, shared by the scan screen and the history list. */
export const RESULT_LABEL: Record<ScanResult, string> = {
  safe: "Safe",
  suspicious: "Suspicious",
  malicious: "Dangerous",
  unknown: "Unverified",
};

/** Map a verdict onto the app's risk scale so `riskColor` can be reused. */
export const RESULT_RISK: Record<ScanResult, "safe" | "warning" | "danger"> = {
  safe: "safe",
  suspicious: "warning",
  malicious: "danger",
  unknown: "warning",
};

/**
 * The one-line summary shown under the score. Distinct per verdict because the
 * safe case needs its caveat and the dangerous case needs an instruction.
 */
export const RESULT_HEADLINE: Record<ScanResult, string> = {
  safe: "No structural warning signs found",
  suspicious: "Some warning signs — check the domain before you sign in",
  malicious: "Do not open this link",
  unknown: "Could not verify this link",
};
