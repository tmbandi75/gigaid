import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { openExternalUrl } from "@/lib/openExternalUrl";

const DEFAULT_SUPPORT_BASE_URL = "https://support.gigaid.ai";
const rawSupportBaseUrl = import.meta.env.VITE_SUPPORT_BASE_URL?.trim();
const SUPPORT_BASE_URL = (rawSupportBaseUrl && rawSupportBaseUrl.length > 0
  ? rawSupportBaseUrl
  : DEFAULT_SUPPORT_BASE_URL
).replace(/\/+$/, "");

export type HelpArticleSlug =
  | "getting-started"
  | "booking-link-public-page"
  | "public-profile"
  | "leads-booking-requests"
  | "jobs"
  | "invoices-payments"
  | "messages-client-communication"
  | "ai-features"
  | "plans-billing"
  | "subscription"
  | "stripe-connect"
  | "notifications"
  | "account-privacy"
  | "troubleshooting";

interface HelpLinkProps {
  slug: HelpArticleSlug;
  label: string;
  className?: string;
  size?: "xs" | "sm";
}

export function HelpLink({ slug, label, className = "", size = "sm" }: HelpLinkProps) {
  const url = `${SUPPORT_BASE_URL}/${slug}`;
  const dimensions = size === "xs" ? "h-6 w-6" : "h-7 w-7";
  const iconSize = size === "xs" ? "h-3.5 w-3.5" : "h-4 w-4";

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void openExternalUrl(url);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleClick}
          aria-label={`Help: ${label}`}
          className={`${dimensions} text-muted-foreground hover:text-foreground rounded-full ${className}`}
          data-testid={`help-link-${slug}`}
        >
          <HelpCircle className={iconSize} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs">Help: {label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
