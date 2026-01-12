import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/nudges/generate");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/nudges"] });
    },
  });
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
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      const res = await apiRequest("PATCH", `/api/feature-flags/${key}`, { enabled });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/feature-flags", variables.key] });
    },
  });
}
