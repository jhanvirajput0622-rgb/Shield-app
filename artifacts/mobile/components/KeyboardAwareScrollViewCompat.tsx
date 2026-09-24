import React from "react";
import { Platform, ScrollView, ScrollViewProps } from "react-native";

type KeyboardAwareScrollViewProps = ScrollViewProps;
type Props = KeyboardAwareScrollViewProps & ScrollViewProps;

export function KeyboardAwareScrollViewCompat({
  children,
  keyboardShouldPersistTaps = "handled",
  ...props
}: Props) {
  if (Platform.OS === "web") {
    return (
      <ScrollView
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        {...props}
      >
        {children}
      </ScrollView>
    );
  }
  // require the native module at runtime to avoid build-time type errors
  const KA = (() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require("react-native-keyboard-controller");
      return mod?.KeyboardAwareScrollView ?? mod;
    } catch {
      return ScrollView;
    }
  })() as React.ComponentType<Props>;

  return (
    <KA keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...props}>
      {children}
    </KA>
  );
}
