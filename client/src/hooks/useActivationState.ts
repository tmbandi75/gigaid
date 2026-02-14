import { useQuery } from "@tanstack/react-query";
import type { ActivationState } from "@shared/activationRules";

export interface ActivationStateResponse extends ActivationState {
  activated: boolean;
}

export function useActivationState(enabled = true) {
  const { data, isLoading, error } = useQuery<ActivationStateResponse>({
    queryKey: ["/api/user/activation-state"],
    staleTime: 60000,
    enabled,
  });

  return {
    state: data ?? null,
    loading: isLoading,
    error: error ?? null,
  };
}
