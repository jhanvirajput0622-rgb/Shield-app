import type { ComponentType } from "react";
import Constants from "expo-constants";

type ObserveModule = typeof import("expo-observe");

// Expo Go does not include the native Expo Observe module.
const observeModule: ObserveModule | null =
  Constants.executionEnvironment === "storeClient"
    ? null
    : require("expo-observe");

const noopUseObserve: ObserveModule["useObserve"] = () => ({
  markInteractive: () => {},
});

export const Observe = observeModule?.Observe;
export const useObserve = observeModule?.useObserve ?? noopUseObserve;

export function wrapObserveRoot<P extends Record<string, unknown>>(
  Component: ComponentType<P>
): ComponentType<P> {
  return observeModule?.ObserveRoot.wrap(Component) ?? Component;
}