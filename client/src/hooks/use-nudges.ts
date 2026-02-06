import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { useApiMutation } from "@/hooks/useApiMutation";
import type { AiNudge } from "@shared/schema";

export function useNudges(entityType?: string, entityId?: string) {
  const queryKey = entityType && entityId 
    ? ["/api/ai/nudges", entityType, entityId]
    : ["/api/ai/nudges"];

  return useQuery<AiNudge[]>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (entityType) params.set("entity_type", entityType);
      if (entityId) params.set("entity_id", entityId);
      const url = `/api/ai/nudges${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch nudges");
      return res.json();
    },
    staleTime: 30000,
  });
}

export function useGenerateNudges() {
  return useApiMutation(
    async () => apiFetch("/api/ai/nudges/generate", { method: "POST" }),
    [["/api/ai/nudges"]]
  );
}

export function useFeatureFlag(key: string) {
  return useQuery<{ key: string; enabled: boolean }>({
    queryKey: ["/api/feature-flags", key],
    queryFn: async () => {
      const res = await fetch(`/api/feature-flags/${key}`);
      if (!res.ok) throw new Error("Failed to fetch feature flag");
      return res.json();
    },
    staleTime: 60000,
  });
}

export function useUpdateFeatureFlag() {
  return useApiMutation(
    async ({ key, enabled }: { key: string; enabled: boolean }) =>
      apiFetch(`/api/feature-flags/${key}`, { method: "PATCH", body: JSON.stringify({ enabled }) }),
    [["/api/feature-flags"]]
  );
}
