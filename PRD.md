# Product Requirements Document (PRD): Shield

## 1. Product Overview
**Product Name:** Shield
**Concept:** A robust, all-in-one mobile security application designed to protect users from modern digital threats. Shield unifies network protection, anti-phishing, app permission monitoring, and anti-theft capabilities into a single, cohesive interface. It is built with a privacy-first mindset, utilizing end-to-end (E2E) encryption and on-device biometric gates to ensure user data remains secure and private.
**Platform:** Mobile (iOS & Android via React Native/Expo).

## 2. Target Audience
- **Privacy-Conscious Individuals:** Users who are highly aware of digital footprints and want proactive protection against tracking and data theft.
- **Remote Workers & Travelers:** Professionals who frequently rely on public, untrusted Wi-Fi networks (cafes, airports, hotels).
- **Security-Minded Smartphone Owners:** Individuals who want robust recovery and data-wiping options if their device is lost or stolen.

## 3. Problem Statement
The current mobile security landscape is highly fragmented. To stay secure, a user typically needs a VPN app for network privacy, a separate service for finding a lost device, and they often lack any proactive defense against modern phishing vectors like malicious QR codes or SMS links. Furthermore, many "security apps" harvest user data. 
**The Solution:** Shield solves this by providing a unified, high-tech, beautifully designed application that handles network encryption, phishing prevention, and physical device security—all while enforcing strict privacy through E2E encryption.

## 4. Core Features

### Must-Have (MVP)
- **Centralized Dashboard:** A comprehensive view displaying an overall "Protection Score," quick stats (Threats Blocked, Apps Scanned, Links Checked), and module status summaries.
- **Network Security (VPN):** One-tap secure VPN connection (WireGuard/ChaCha20-Poly1305) to encrypt traffic, with automatic detection and warnings for unsecured open Wi-Fi networks.
- **Web Protection (Phishing Check):** A URL checking tool to verify links against threat databases. Includes a QR code scanner to intercept malicious codes before they open in a browser. URLs are E2E encrypted before leaving the device.
- **Anti-Theft System (Locate & Lock):** Remote tracking of the device's GPS coordinates and the ability to remotely lock the screen with a custom message.
- **On-Device Cryptography:** Generation and local storage of an E2E device key during onboarding.
- **Biometric Security Gates:** Utilizing FaceID/TouchID to authorize destructive or high-risk actions (e.g., Remote Wipe).

### Nice-to-Have (Post-MVP / Fast Follows)
- **Network Kill Switch:** Automatically block all internet traffic if the VPN connection drops unexpectedly.
- **Auto-Connect Rules:** Automatically engage the VPN when joining known untrusted networks.
- **App Permissions Monitor:** A module to scan and audit other installed apps for invasive permissions (camera, microphone, location).
- **Anti-Theft Remote Wipe:** Irreversible remote erasure of the device (already partially implemented with biometric gating, but requires robust backend acknowledgment logic).

## 5. User Flows

### A. First-Time Onboarding
1. User installs and opens Shield.
2. High-tech loading sequence with pulsing security aesthetics.
3. App generates a local cryptographic key pair for E2E encryption.
4. User is prompted to grant necessary permissions (Camera for QR, Location for Anti-Theft, Notifications).
5. User lands on the Dashboard showing their initial Protection Score.

### B. Securing an Untrusted Network
1. User connects to a public cafe Wi-Fi.
2. Shield detects the network is unsecured and sends a push notification.
3. User taps the notification, opening the Network module.
4. User taps "Enable VPN Protection".
5. App establishes a secure tunnel and updates status to "Encrypted".

### C. Checking a Suspicious QR Code
1. User finds a QR code on a parking meter.
2. User opens Shield -> Web Protection -> taps Camera icon.
3. App scans the QR code and extracts the URL.
4. URL is hashed/encrypted and checked against the threat DB.
5. App displays a high-visibility RED alert: "Threat Detected - Malicious Pattern".

### D. Anti-Theft Mitigation
1. User loses their device.
2. User logs into the companion web portal and issues a "Locate" and "Lock" command.
3. The device receives the command silently, locks the screen with a recovery message, and pings back high-precision GPS coordinates.
4. If recovery fails, the user issues a "Wipe" command. The device verifies the command and permanently erases data.

## 6. What the MVP Looks Like
The MVP is a heavily stylized, dark-mode React Native (Expo) application. It prioritizes **rich aesthetics**, utilizing vibrant accent colors (neon greens for safe, reds for critical), glassmorphism, smooth micro-animations, and haptic feedback. 
The app is divided into 4 main tabs:
- **Index/Dashboard:** The command center.
- **Network:** Wi-Fi and VPN controls.
- **Web Protection:** Phishing log, URL input, and QR scanner.
- **Anti-Theft:** Live map preview, device telemetry, Lock/Wipe controls.

## 7. Success Metrics (KPIs)
- **Adoption:** Number of Active VPN Sessions established per week.
- **Engagement:** Average number of URLs/QR codes checked per user per month.
- **Utility:** Number of malicious threats successfully blocked.
- **Retention:** Day 7 and Day 30 user retention rates.
- **Performance:** Time-to-connect for the VPN (should be < 2 seconds).

## 8. Out of Scope (What we are NOT building in V1)
- **OS-Level Sandboxing:** We are not building a custom Android ROM or root-level firewall; we operate within standard OS sandboxing limits.
- **Desktop Clients:** V1 is strictly mobile-first (iOS & Android). MacOS/Windows clients are deferred.
- **Custom VPN Protocol:** We will leverage established protocols (WireGuard, OpenVPN) rather than inventing a proprietary encryption transport.
- **Parental Controls:** No content filtering for explicit material; the focus remains strictly on security and malware/phishing threats.
- **Cloud Backup:** We protect the device, but we do not offer cloud storage for personal photos or files.
