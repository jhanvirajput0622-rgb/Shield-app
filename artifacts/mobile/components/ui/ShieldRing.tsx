import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { overallStatusColor } from "@/lib/utils";

interface ShieldRingProps {
  status: string;
  score: number;
  size?: number;
}

export function ShieldRing({ status, score, size = 140 }: ShieldRingProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const color = overallStatusColor(status);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.06,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.7,
            duration: 1800,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.4,
            duration: 1800,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const ringSize = size;
  const innerSize = ringSize - 20;
  const coreSize = innerSize - 20;
  const iconSize = Math.round(size * 0.3);

  return (
    <View
      style={[
        styles.container,
        { width: ringSize + 40, height: ringSize + 40 },
      ]}
    >
      {/* Outer glow ring */}
      <Animated.View
        style={[
          styles.ring,
          {
            width: ringSize + 40,
            height: ringSize + 40,
            borderRadius: (ringSize + 40) / 2,
            borderColor: color,
            opacity: glowAnim,
          },
        ]}
      />
      {/* Middle ring */}
      <Animated.View
        style={[
          styles.ring,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            borderColor: color,
            borderWidth: 2,
            opacity: glowAnim,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />
      {/* Inner core */}
      <View
        style={[
          styles.core,
          {
            width: coreSize,
            height: coreSize,
            borderRadius: coreSize / 2,
            backgroundColor: `${color}22`,
            borderColor: `${color}66`,
          },
        ]}
      >
        <Feather name="shield" size={iconSize} color={color} />
        <Text style={[styles.coreText, { color }]}>{score}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    borderWidth: 1,
    borderStyle: "solid",
  },
  core: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  coreText: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: "700",
  },
});
