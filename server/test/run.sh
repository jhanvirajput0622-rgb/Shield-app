#!/usr/bin/env bash
#
# Runs the E2E suite against the local Firestore emulator.
#
# Why `emulators:exec` rather than starting the emulator separately: it owns the
# emulator lifecycle, waits for readiness before handing control to the test
# command, and guarantees shutdown (including on failure) so a crashed run never
# leaves a stray process holding port 8080.
#
# Prerequisite: JDK 21+. firebase-tools dropped support for Java < 21, and the
# Firestore emulator is a JVM app. `find_java_home` below locates a suitable
# JDK; override with JAVA_HOME=/path/to/jdk21 if autodetection picks wrong.

set -euo pipefail

SERVER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "${SERVER_DIR}/.." && pwd)"

# ── Locate a JDK 21+ ───────────────────────────────────────────────────────────
find_java_home() {
  if [[ -n "${JAVA_HOME:-}" ]] && "$JAVA_HOME/bin/java" -version 2>&1 | grep -qE '"(2[1-9]|[3-9][0-9])'; then
    echo "$JAVA_HOME"
    return 0
  fi

  local candidate
  # Common install locations, newest-looking first.
  for candidate in /opt/java/jdk21 /usr/lib/jvm/java-21-openjdk-amd64 /usr/lib/jvm/temurin-21-jdk-amd64 /usr/lib/jvm/jdk-21; do
    if [[ -x "${candidate}/bin/java" ]]; then
      echo "$candidate"
      return 0
    fi
  done

  # Fall back to whatever is on PATH.
  if command -v java >/dev/null 2>&1 && java -version 2>&1 | grep -qE '"(2[1-9]|[3-9][0-9])'; then
    dirname "$(dirname "$(readlink -f "$(command -v java)")")"
    return 0
  fi

  return 1
}

if ! JAVA_HOME_RESOLVED="$(find_java_home)"; then
  cat >&2 <<'EOF'

  The Firestore emulator requires JDK 21 or newer, and no suitable JDK was found.

  firebase-tools >= 14 refuses to start the emulator on Java < 21.

  Install one, then re-run:

    Debian/Ubuntu : sudo apt-get install -y openjdk-21-jdk
    macOS         : brew install openjdk@21
    or            : set JAVA_HOME=/path/to/jdk21

EOF
  exit 1
fi
export JAVA_HOME="$JAVA_HOME_RESOLVED"
export PATH="${JAVA_HOME}/bin:${PATH}"

# ── Emulator wiring ────────────────────────────────────────────────────────────
export FIREBASE_PROJECT_ID="demo-shield"
export GOOGLE_CLOUD_PROJECT="demo-shield"
# The Admin SDK reads this; firebase-tools sets it for us inside `exec`, but set it
# here too so a directly-invoked test binary still refuses to touch a real project.
export FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"

# Rate limiters and JWT config are set by test/helpers/env.ts, which every test
# file imports first. Only the emulator needs wiring at this level.

# ── Run ────────────────────────────────────────────────────────────────────────
cd "${REPO_ROOT}"

echo "→ Compiling server + tests"
(cd "${SERVER_DIR}" && npx tsc -p tsconfig.test.json)

echo "→ Starting Firestore emulator and running suite"

# `--concurrency=1` is deliberate. Every suite truncates the shared emulator
# before it runs, so parallel files would delete each other's fixtures. The
# emulator is a single shared resource, not a per-worker one.
#
# `emulators:exec` is invoked from the repo root because that is where
# firebase.json, firestore.rules and firestore.indexes.json live. The compiled
# tests live under server/dist-test.
firebase emulators:exec \
  --only firestore \
  --project "${FIREBASE_PROJECT_ID}" \
  --config "${REPO_ROOT}/firebase.json" \
  "node --test --test-concurrency=1 ${SERVER_DIR}/dist-test/test/"
