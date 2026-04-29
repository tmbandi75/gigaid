import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/queryKeys";

interface SmsOptOutProfile {
  smsOptOut?: boolean;
}

export const SMS_OPT_OUT_TOOLTIP =
  "SMS is paused. Tap Resume SMS in the banner above to start sending again.";

export function useSmsOptOut(): { smsOptOut: boolean; isLoading: boolean } {
  const { data, isLoading } = useQuery<SmsOptOutProfile>({
    queryKey: QUERY_KEYS.profile(),
  });

  return {
    smsOptOut: data?.smsOptOut === true,
    isLoading,
  };
}
