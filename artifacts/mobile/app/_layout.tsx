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
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import { AppProvider } from "@/context/AppContext";
import colors from "@/constants/colors";
import { getBaseUrl, getToken } from "@/lib/apiClient";

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

const HEADER_OPTS = {
  headerStyle: { backgroundColor: c.background },
  headerTintColor: c.primary,
  headerTitleStyle: { color: c.foreground, fontWeight: "700" as const },
  headerShadowVisible: false,
};

function RootLayoutNav() {
  return (
    <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AppProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProviderCompat>
                <RootLayoutNav />
              </KeyboardProviderCompat>
            </GestureHandlerRootView>
          </AppProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
