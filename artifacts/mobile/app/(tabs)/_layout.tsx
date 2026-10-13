import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import type { ColorValue } from "react-native";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import colors from "../../constants/colors";

export default function TabLayout() {
  const c = colors.dark;
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textDisabled,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : c.surface,
          borderTopWidth: 1,
          borderTopColor: c.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              tint="dark"
              intensity={80}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: c.surface },
              ]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }: { color: ColorValue }) => (
            <Feather name="grid" color={color} size={22} />
          ),
        }}
      />
      <Tabs.Screen
        name="protection"
        options={{
          title: "Protection",
          tabBarIcon: ({ color }: { color: ColorValue }) => (
            <Feather name="shield" color={color} size={22} />
          ),
        }}
      />
      <Tabs.Screen
        name="app"
        options={{
          title: "Apps",
          tabBarIcon: ({ color }: { color: ColorValue }) => (
            <Feather name="smartphone" color={color} size={22} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }: { color: ColorValue }) => (
            <Feather name="settings" color={color} size={22} />
          ),
        }}
      />
    </Tabs>
  );
}
