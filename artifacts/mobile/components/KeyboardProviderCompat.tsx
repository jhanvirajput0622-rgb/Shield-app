import React from "react";

type Props = { children: React.ReactNode };

const Passthrough = ({ children }: Props) => <>{children}</>;

// `react-native-keyboard-controller` ships native code that Expo Go (client
// 57.0.9) does not include — a static import crashes the bundle at startup
// with "You are not using Expo Go". Require it at runtime and fall back to a
// pass-through provider so the app still boots in Expo Go; dev-client / EAS
// builds keep the full keyboard avoidance behaviour.
const KeyboardProviderImpl = ((): React.ComponentType<Props> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-keyboard-controller");
    return (mod?.KeyboardProvider ?? Passthrough) as React.ComponentType<Props>;
  } catch {
    return Passthrough;
  }
})();

export function KeyboardProviderCompat({ children }: Props) {
  const Provider = KeyboardProviderImpl;
  return <Provider>{children}</Provider>;
}
