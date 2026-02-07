import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";
import { useLocation } from "wouter";
import { trackEvent } from "@/components/PostHogProvider";

interface PostSuccessNudgeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  current?: number;
  limit?: number;
  remaining?: number;
}

export function PostSuccessNudgeModal({
  open,
  onOpenChange,
  title,
  description,
  current,
  limit,
  remaining,
}: PostSuccessNudgeModalProps) {
  const [, navigate] = useLocation();

  const handleUpgrade = () => {
    trackEvent('upgrade_from_nudge', {
      source: 'post_success_nudge',
      title,
      current,
      limit,
    });
    onOpenChange(false);
    navigate("/pricing");
  };

  const handleDismiss = () => {
    onOpenChange(false);
  };

  const percentage = limit && limit > 0 ? Math.round(((current || 0) / limit) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" data-testid="dialog-post-success-nudge">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center" data-testid="text-nudge-title">
            {title}
          </DialogTitle>
          <DialogDescription className="text-center" data-testid="text-nudge-description">
            {description}
          </DialogDescription>
        </DialogHeader>

        {limit !== undefined && limit > 0 && (
          <div className="my-2 px-1">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{current || 0} / {limit} used</span>
              {remaining !== undefined && <span>{remaining} left</span>}
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  percentage >= 90 ? "bg-destructive" : percentage >= 70 ? "bg-amber-500" : "bg-primary"
                }`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          <Button
            onClick={handleUpgrade}
            className="w-full"
            data-testid="button-nudge-upgrade"
          >
            View Plans
          </Button>
          <Button
            variant="ghost"
            onClick={handleDismiss}
            className="w-full"
            data-testid="button-nudge-dismiss"
          >
            Not now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
