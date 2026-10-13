import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "@/constants/colors";

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryLoading?: boolean;
  /** If set, the primary action stays disabled until user types this exact string. */
  requireConfirmation?: string;
  destructive?: boolean;
}

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  primaryLabel,
  onPrimary,
  primaryLoading,
  requireConfirmation,
  destructive,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(300)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (visible) {
      setConfirmText("");
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const canConfirm = requireConfirmation
    ? confirmText === requireConfirmation
    : true;

  const primaryDisabled = !canConfirm || primaryLoading;

  const c = colors.dark;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.avoidView}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [{ translateY: slideAnim }],
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          {/* Drag handle */}
          <View style={styles.handle} />

          <Text style={styles.title}>{title}</Text>

          {children}

          {requireConfirmation && (
            <View style={styles.confirmSection}>
              <Text style={styles.confirmLabel}>
                Type{" "}
                <Text style={{ color: c.danger }}>"{requireConfirmation}"</Text>{" "}
                to confirm
              </Text>
              <TextInput
                style={styles.confirmInput}
                value={confirmText}
                onChangeText={setConfirmText}
                placeholder={requireConfirmation}
                placeholderTextColor={c.textDisabled}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}

          {primaryLabel && onPrimary && (
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                destructive && styles.destructiveBtn,
                primaryDisabled && styles.disabledBtn,
              ]}
              onPress={onPrimary}
              disabled={primaryDisabled}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.primaryBtnText,
                  destructive && styles.destructiveBtnText,
                  primaryDisabled && styles.disabledBtnText,
                ]}
              >
                {primaryLoading ? "Processing..." : primaryLabel}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const c = colors.dark;

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  avoidView: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: c.elevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingTop: 12,
    borderWidth: 1,
    borderColor: c.border,
    borderBottomWidth: 0,
    gap: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: c.borderStrong,
    alignSelf: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: c.foreground,
    marginBottom: 4,
  },
  confirmSection: {
    gap: 8,
  },
  confirmLabel: {
    fontSize: 13,
    color: c.mutedForeground,
  },
  confirmInput: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: c.foreground,
    fontFamily: "monospace",
  },
  primaryBtn: {
    backgroundColor: c.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: c.primaryForeground,
  },
  destructiveBtn: {
    backgroundColor: c.destructive,
  },
  destructiveBtnText: {
    color: "#fff",
  },
  disabledBtn: {
    opacity: 0.4,
  },
  disabledBtnText: {},
  cancelBtn: {
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 15,
    color: c.mutedForeground,
    fontWeight: "500",
  },
});
