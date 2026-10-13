import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiClient";
import { extractDomain, hashUrl, getDeviceKey, encryptSensitive } from "../lib/crypto";

export type PhishingVerdict = "safe" | "malicious" | "unknown" | "suspicious";

export type PhishingLogEntry = {
  id: string;
  domain: string;
  verdict: PhishingVerdict;
  threatType?: string;
  checkedAt: string;
  source: string;
};

type PhishingLog = {
  entries: PhishingLogEntry[];
  totalScanned: number;
  threatsBlocked: number;
};

type CheckUrlResponse = {
  verdict: PhishingVerdict;
  threatType?: string;
  message: string;
  logEntry: PhishingLogEntry;
};

export function usePhishing() {
  const queryClient = useQueryClient();

  const { data: log, isLoading, refetch, isError } = useQuery<PhishingLog>({
    queryKey: ["phishing-log"],
    queryFn: () => apiFetch<PhishingLog>("/api/shield/phishing/log"),
    staleTime: 15_000,
  });

  const checkMutation = useMutation({
    mutationFn: async ({
      url,
      source,
    }: {
      url: string;
      source: "manual_check" | "qr";
    }): Promise<{ verdict: string; message: string }> => {
      const domain = extractDomain(url);
      const urlHash = hashUrl(url);

      // E2E encrypt the full URL before sending — server stores ciphertext only
      let encryptedUrl: string | undefined;
      try {
        const key = await getDeviceKey();
        encryptedUrl = encryptSensitive(url, key);
      } catch {
        // Encryption failure is non-fatal — proceed without encryptedUrl
      }

      const result = await apiFetch<CheckUrlResponse>(
        "/api/shield/phishing/check",
        {
          method: "POST",
          body: {
            urlHash,
            domain,
            encryptedUrl,
            source,
          },
        }
      );

      return { verdict: result.verdict, message: result.message };
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["phishing-log"] }),
  });

  const clearLogMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean }>("/api/shield/phishing/log", {
        method: "DELETE",
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["phishing-log"] }),
  });

  return {
    log,
    isLoading,
    refetch,
    isError,
    checkUrl: (url: string, source: "manual" | "qr") =>
      checkMutation.mutateAsync({
        url,
        source: source === "qr" ? "qr" : "manual_check",
      }),
    clearLog: () => clearLogMutation.mutateAsync(),
    isChecking: checkMutation.isPending,
  };
}
