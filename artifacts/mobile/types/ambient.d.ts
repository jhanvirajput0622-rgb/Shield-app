declare const process: {
  env: Record<string, string | undefined> & {
    EXPO_PUBLIC_API_URL?: string;
    EXPO_PUBLIC_DOMAIN?: string;
    NODE_ENV?: string;
  };
};

declare module "react-native-gesture-handler" {
  export class GestureHandlerRootView extends React.Component<any> {}
}

declare module "react-native-keyboard-controller" {
  export class KeyboardProvider extends React.Component<any> {}
}

declare module "react-native-safe-area-context" {
  export interface EdgeInsets {
    top: number;
    bottom: number;
    left: number;
    right: number;
  }
  export function useSafeAreaInsets(): EdgeInsets;
  export class SafeAreaProvider extends React.Component<any> {}
}

declare module "@expo-google-fonts/inter" {
  export const Inter_400Regular: string;
  export const Inter_500Medium: string;
  export const Inter_600SemiBold: string;
  export const Inter_700Bold: string;
  export function useFonts(fonts: Record<string, unknown>): [boolean, Error | null];
}

declare module "expo-splash-screen" {
  export function preventAutoHideAsync(): Promise<void>;
  export function hideAsync(): Promise<void>;
}

declare module "expo-haptics" {
  export enum NotificationFeedbackType {
    Success = "success",
    Warning = "warning",
    Error = "error",
  }
  export enum ImpactFeedbackStyle {
    Light = "light",
    Medium = "medium",
  }
  export function notificationAsync(type: NotificationFeedbackType): Promise<void>;
  export function impactAsync(style: ImpactFeedbackStyle): Promise<void>;
  export function selectionAsync(): Promise<void>;
}

declare module "expo-camera" {
  export interface BarcodeScanningResult {
    data: string;
  }
  export interface CameraPermissionResponse {
    granted: boolean;
    canAskAgain: boolean;
  }
  export const CameraView: any;
  export function useCameraPermissions(): [CameraPermissionResponse | null, (options?: Record<string, unknown>) => Promise<CameraPermissionResponse>];
}

declare module "expo-location" {
  export const Accuracy: { High: string };
  export function requestForegroundPermissionsAsync(): Promise<{ status: string }>;
  export function getCurrentPositionAsync(options?: Record<string, unknown>): Promise<{ coords: { latitude: number; longitude: number; accuracy: number | null } }>;
}

declare module "expo-local-authentication" {
  export function hasHardwareAsync(): Promise<boolean>;
  export function isEnrolledAsync(): Promise<boolean>;
  export function authenticateAsync(options: Record<string, unknown>): Promise<{ success: boolean }>;
}

declare module "@expo/vector-icons" {
  export const Feather: any;
}

declare module "expo-blur" {
  export const BlurView: any;
}

declare module "expo-notifications" {
  export function getPermissionsAsync(): Promise<{ status: string }>;
  export function requestPermissionsAsync(): Promise<{ status: string }>;
}

declare module "expo" {
  export function reloadAppAsync(): Promise<void>;
}

declare module "tweetnacl" {
  const nacl: {
    randomBytes(length: number): Uint8Array;
    secretbox: {
      keyLength: number;
      nonceLength: number;
      (message: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array;
      open(box: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array | null;
    };
    hash(bytes: Uint8Array): Uint8Array;
  };
  export default nacl;
}

declare module "tweetnacl-util" {
  export function encodeBase64(data: Uint8Array): string;
  export function decodeBase64(data: string): Uint8Array | null;
  export function encodeUTF8(data: Uint8Array): string;
  export function decodeUTF8(text: string): Uint8Array;
}

