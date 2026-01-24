import { cn } from "@/lib/utils";
import { Info } from "lucide-react";
import { Button } from "./button";

interface InlineInfoCardProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function InlineInfoCard({
  title,
  description,
  actionLabel,
  onAction,
  className
}: InlineInfoCardProps) {
  return (
    <div 
      className={cn(
        "rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 p-4 space-y-2",
        className
      )}
      data-testid="card-inline-info"
    >
      <div className="flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-1">
          <p className="font-medium text-sm text-foreground" data-testid="text-inline-info-title">
            {title}
          </p>
          <p className="text-sm text-muted-foreground" data-testid="text-inline-info-description">
            {description}
          </p>
          {actionLabel && onAction && (
            <Button
              variant="ghost"
              size="sm"
              className="p-0 text-blue-600 dark:text-blue-400 underline"
              onClick={onAction}
              data-testid="button-inline-info-action"
            >
              {actionLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
