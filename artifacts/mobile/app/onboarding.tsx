import React, { useRef, useState } from "react";
import {
  Animated,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

const SLIDES = [
  {
    key: "1",
    icon: "smartphone" as const,
    color: colors.dark.warning,
    title: "App Permissions Auditor",
    body: "Many apps request permissions they don't need. Shield scans your installed apps and flags anything suspicious — so you stay in control of your data.",
  },
  {
    key: "2",
    icon: "wifi" as const,
    color: colors.dark.danger,
    title: "Network Security",
    body: "Public Wi-Fi is risky. Shield detects unsecured networks and offers one-tap VPN protection — keeping your traffic encrypted wherever you are.",
  },
  {
    key: "3",
    icon: "link" as const,
    color: colors.dark.primary,
    title: "Anti-Phishing",
    body: "Phishing links are getting harder to spot. Shield checks URLs you encounter — and if we can't verify a link, we tell you so. We never assume safe.",
  },
  {
    key: "4",
    icon: "map-pin" as const,
    color: colors.dark.safe,
    title: "Anti-Theft",
    body: "If your device is lost or stolen, Shield lets you locate it, lock it remotely, or wipe it completely — with safeguards to prevent accidental actions.",
  },
];

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { completeOnboarding } = useApp();
  const [currentIndex, setCurrentIndex] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const finish = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await completeOnboarding();
      router.replace("/(tabs)");
    } catch {
      Alert.alert("Unable to continue", "Please try again.");
    }
  };

  const goTo = (idx: number) => {
    Animated.timing(slideAnim, {
      toValue: -idx * width,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setCurrentIndex(idx);
  };

  const next = () => {
    if (currentIndex < SLIDES.length - 1) {
      Haptics.selectionAsync();
      goTo(currentIndex + 1);
    } else {
      finish();
    }
  };

  const c = colors.dark;
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const SLIDE_HEIGHT = Math.min(440, 440);

  return (
    <View style={[styles.container, { paddingTop: topPad + 16 }]}>
      {/* Skip */}
      <TouchableOpacity
        style={styles.skipBtn}
        onPress={finish}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Slide strip — overflow hidden on the wrapper */}
      <View style={[styles.slideWindow, { height: SLIDE_HEIGHT }]}>
        <Animated.View
          style={[
            styles.slideStrip,
            {
              width: width * SLIDES.length,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          {SLIDES.map((item) => (
            <View key={item.key} style={[styles.slide, { width }]}>
              <View
                style={[
                  styles.iconCircle,
                  {
                    backgroundColor: `${item.color}20`,
                    borderColor: `${item.color}40`,
                  },
                ]}
              >
                <Feather name={item.icon} size={48} color={item.color} />
              </View>
              <View style={styles.slideText}>
                <Text style={styles.slideTitle}>{item.title}</Text>
                <Text style={styles.slideBody}>{item.body}</Text>
              </View>
            </View>
          ))}
        </Animated.View>
      </View>

      {/* Pagination dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <TouchableOpacity key={i} onPress={() => goTo(i)}>
            <View
              style={[
                styles.dot,
                i === currentIndex
                  ? { backgroundColor: c.primary, width: 20 }
                  : { backgroundColor: c.borderStrong },
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={[styles.ctaBtn, { marginBottom: bottomPad + 16 }]}
        onPress={next}
        activeOpacity={0.85}
      >
        <Text style={styles.ctaText}>
          {currentIndex < SLIDES.length - 1 ? "Next" : "Get Started"}
        </Text>
        <Feather
          name={currentIndex < SLIDES.length - 1 ? "arrow-right" : "check"}
          size={18}
          color={c.primaryForeground}
        />
      </TouchableOpacity>
    </View>
  );
}

const c = colors.dark;
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
    alignItems: "center",
  },
  skipBtn: {
    alignSelf: "flex-end",
    paddingHorizontal: 24,
    paddingVertical: 8,
    marginBottom: 8,
  },
  skipText: {
    fontSize: 15,
    color: c.mutedForeground,
    fontWeight: "500",
  },
  slideWindow: {
    width: "100%",
    overflow: "hidden",
    flex: 1,
  },
  slideStrip: {
    flexDirection: "row",
    height: "100%",
  },
  slide: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 32,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  slideText: {
    alignItems: "center",
    gap: 12,
  },
  slideTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: c.foreground,
    textAlign: "center",
  },
  slideBody: {
    fontSize: 15,
    color: c.mutedForeground,
    textAlign: "center",
    lineHeight: 22,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    marginTop: 20,
    marginBottom: 20,
  },
  dot: {
    height: 6,
    borderRadius: 999,
    width: 6,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: c.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: "85%",
    justifyContent: "center",
  },
  ctaText: {
    fontSize: 17,
    fontWeight: "700",
    color: c.primaryForeground,
  },
});
