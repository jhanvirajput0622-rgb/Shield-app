import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import colors from "@/constants/colors";

const LOADING_MESSAGES = [
  "Initializing secure environment...",
  "Verifying encryption keys...",
  "Scanning local network...",
  "Establishing secure connection...",
];

export function LoadingState() {
  const c = colors.dark;
  const [messageIndex, setMessageIndex] = useState(0);

  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.7);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 3000, easing: Easing.linear }),
      -1
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(1.0, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.7, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [rotation, scale, opacity]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const shieldStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.animationContainer}>
        {/* Outer rotating dashed ring */}
        <Animated.View
          style={[
            styles.ring,
            { borderColor: c.primary, shadowColor: c.primary },
            ringStyle,
          ]}
        >
          <View style={[styles.ringGap, { backgroundColor: c.background }]} />
        </Animated.View>

        {/* Inner pulsing shield icon — cross-platform Feather icon */}
        <Animated.View style={[styles.shieldContainer, shieldStyle]}>
          <Feather
            name="shield"
            size={48}
            color={c.primary}
          />
        </Animated.View>
      </View>

      <Text style={[styles.text, { color: c.primary }]}>
        {LOADING_MESSAGES[messageIndex]}
      </Text>
    </View>
  );
}

const c = colors.dark;
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  animationContainer: {
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
  },
  ring: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderStyle: "dashed",
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  ringGap: {
    position: "absolute",
    top: -5,
    left: "50%",
    marginLeft: -10,
    width: 20,
    height: 10,
  },
  shieldContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: 0.5,
    textAlign: "center",
  },
});
