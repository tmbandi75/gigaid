import { ApproachingLimitBanner } from "@/components/upgrade/ApproachingLimitBanner";
import type { NewCapability } from "@/hooks/useCapability";

interface MonthlyLimitWarningsProps {
  capabilities?: NewCapability[];
  source?: string;
  className?: string;
}

const DEFAULT_CAPABILITIES: NewCapability[] = [
  "jobs.create",
  "sms.two_way",
  "sms.auto_followups",
  "deposit.enforce",
  "price.confirmation",
  "offline.photos",
];

export function MonthlyLimitWarnings({
  capabilities = DEFAULT_CAPABILITIES,
  source,
  className = "",
}: MonthlyLimitWarningsProps) {
  return (
    <div className={`space-y-2 ${className}`} data-testid="container-monthly-limit-warnings">
      {capabilities.map((cap) => (
        <ApproachingLimitBanner key={cap} capability={cap} source={source} />
      ))}
    </div>
  );
}
