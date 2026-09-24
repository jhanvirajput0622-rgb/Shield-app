import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getDeviceKey } from "@/lib/crypto";
import { rehydrate } from "@/store/authStore";

interface AppContextType {
  hasOnboarded: boolean | null; // null = loading
  completeOnboarding: () => Promise<void>;
  deviceKey: Uint8Array | null;
}

const AppContext = createContext<AppContextType>({
  hasOnboarded: null,
  completeOnboarding: async () => {},
  deviceKey: null,
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);
  const [deviceKey, setDeviceKey] = useState<Uint8Array | null>(null);

  useEffect(() => {
    // Load onboarding state, E2E encryption key, and silently rehydrate auth
    Promise.all([
      AsyncStorage.getItem("@shield/onboarded"),
      getDeviceKey(),
      rehydrate(), // attempt silent sign-in from stored JWT
    ])
      .then(([onboarded, key]) => {
        setHasOnboarded(onboarded === "true");
        setDeviceKey(key);
      })
      .catch((err) => {
        console.error("Failed to initialize app state:", err);
        // Fallback so the app doesn't stay stuck on a blank screen
        setHasOnboarded(false);
      });
  }, []);

  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem("@shield/onboarded", "true");
    setHasOnboarded(true);
  }, []);

  return (
    <AppContext.Provider
      value={{ hasOnboarded, completeOnboarding, deviceKey }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
