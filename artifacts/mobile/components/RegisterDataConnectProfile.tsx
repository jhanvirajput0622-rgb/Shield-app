import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { insertUser } from "@/src/generated/dataconnect";
import { getShieldDataConnect } from "@/lib/dataConnect";
import colors from "@/constants/colors";

const c = colors.dark;

type Props = {
  onRegistered?: (userId: string) => void;
};

export default function RegisterDataConnectProfile({
  onRegistered,
}: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);

  const submit = async () => {
    setError(null);
    setRegistered(false);

    if (!name.trim()) {
      setError("Name is required.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await insertUser(getShieldDataConnect(), {
        name: name.trim(),
        phone: phone.trim() || null,
      });

      setRegistered(true);
      onRegistered?.(data.user_insert.id);
    } catch (cause: unknown) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Profile registration failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create profile</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Full name"
        placeholderTextColor={c.textDisabled}
        autoComplete="name"
        returnKeyType="next"
      />
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="Phone (optional)"
        placeholderTextColor={c.textDisabled}
        keyboardType="phone-pad"
        autoComplete="tel"
        returnKeyType="done"
      />

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {registered ? <Text style={styles.success}>Profile created.</Text> : null}

      <Pressable
        accessibilityRole="button"
        disabled={loading}
        onPress={submit}
        style={[styles.button, loading && styles.buttonDisabled]}
      >
        {loading ? (
          <ActivityIndicator color={c.background} />
        ) : (
          <Text style={styles.buttonText}>Create profile</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  title: { color: c.foreground, fontSize: 20, fontWeight: "700" },
  input: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderRadius: 6,
    borderWidth: 1,
    color: c.foreground,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  error: { color: c.danger, fontSize: 14 },
  success: { color: c.safe, fontSize: 14 },
  button: {
    alignItems: "center",
    backgroundColor: c.primary,
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 48,
  },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: c.background, fontSize: 15, fontWeight: "700" },
});