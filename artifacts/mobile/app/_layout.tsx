import "react-native-get-random-values";
import React, { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { KeyboardProviderCompat } from "@/components/KeyboardProviderCompat";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import { AppProvider } from "@/context/AppContext";
import { useApp } from "@/context/AppContext";
import colors from "@/constants/colors";
import { Observe, useObserve, wrapObserveRoot } from "@/lib/easObserve";
import { getBaseUrl, getToken } from "@/lib/apiClient";
import { useAuthStore } from "@/store/authStore";

Observe?.configure({
  integrations: {
    "expo-router": {
      filteredParams: ["email", "token", "code"],
    },
  },
});

const apiBase = getBaseUrl();

if (apiBase) {
  setBaseUrl(apiBase);
}

setAuthTokenGetter(getToken);

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 30_000 },
  },
});

const c = colors.dark;
const PUBLIC_ROUTES = new Set([
  "login",
  "register",
  "forgot-password",
  "reset-password",
  "onboarding",
]);

const HEADER_OPTS = {
  headerStyle: { backgroundColor: c.background },
  headerTintColor: c.primary,
  headerTitleStyle: { color: c.foreground, fontWeight: "700" as const },
  headerShadowVisible: false,
};

function RootLayoutNav() {
  return (
    <Stack initialRouteName="(tabs)">
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen
          name="forgot-password"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="reset-password"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="network"
          options={{ ...HEADER_OPTS, title: "Network Security" }}
        />
        <Stack.Screen
          name="phishing"
          options={{ ...HEADER_OPTS, title: "Web Protection" }}
        />
        <Stack.Screen
          name="antitheft"
          options={{ ...HEADER_OPTS, title: "Anti-Theft" }}
        />
    </Stack>
  );
}

function RootLayoutContent() {
  const { hasOnboarded } = useApp();
  const { markInteractive } = useObserve();
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthStore();

  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    if (hasOnboarded !== null) {
      markInteractive();
    }
  }, [hasOnboarded, markInteractive]);

  useEffect(() => {
    if (!navigationState?.key || hasOnboarded === null || isAuthLoading) return;

    const currentRoute = segments[0];
    if (!isAuthenticated && !PUBLIC_ROUTES.has(currentRoute ?? "")) {
      router.replace("/login");
      return;
    }

    if (isAuthenticated && (currentRoute === "login" || currentRoute === "register")) {
      router.replace(hasOnboarded ? "/(tabs)" : "/onboarding");
    }
  }, [
    hasOnboarded,
    isAuthenticated,
    isAuthLoading,
    navigationState?.key,
    router,
    segments,
  ]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProviderCompat>
        <RootLayoutNav />
      </KeyboardProviderCompat>
    </GestureHandlerRootView>
  );
}

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary onError={(error) => Observe?.reportError(error)}>
        <QueryClientProvider client={queryClient}>
          <AppProvider>
            <RootLayoutContent />
          </AppProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default wrapObserveRoot(RootLayout);
