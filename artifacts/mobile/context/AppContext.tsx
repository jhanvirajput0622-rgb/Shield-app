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
    // Resolve UI initialization independently; auth/network failures must not
    // leave onboarding state null and block the entire navigation tree.
    void AsyncStorage.getItem("@shield/onboarded")
      .then((onboarded) => setHasOnboarded(onboarded === "true"))
      .catch((err: unknown) => {
        console.error("Failed to load onboarding state:", err);
        setHasOnboarded(false);
      });

    void getDeviceKey()
      .then(setDeviceKey)
      .catch((err: unknown) => {
        console.error("Failed to load device encryption key:", err);
        setDeviceKey(null);
      });

    void rehydrate().catch((err: unknown) => {
      console.warn("Could not restore the previous session:", err);
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
