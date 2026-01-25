import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
import { Link } from "wouter";

interface BlockingInterceptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  price: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function BlockingIntercept({
  open,
  onOpenChange,
  title,
  description,
  price,
  onConfirm,
  onCancel
}: BlockingInterceptProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="blocking-intercept-dialog">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center" data-testid="blocking-intercept-title">
            {title}
          </DialogTitle>
          <DialogDescription className="text-center" data-testid="blocking-intercept-description">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 p-4 border rounded-lg text-center">
          <p className="text-2xl font-bold" data-testid="blocking-intercept-price">{price}</p>
          <p className="text-sm text-muted-foreground">Cancel anytime. No long-term commitment.</p>
        </div>

        <DialogFooter className="flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1"
              data-testid="button-blocking-cancel"
            >
              Continue without protection
            </Button>
            <Button
              onClick={onConfirm}
              className="flex-1"
              data-testid="button-blocking-confirm"
            >
              Upgrade to Pro+
            </Button>
          </div>
          <div className="text-center">
            <Link href="/pricing" className="text-sm text-muted-foreground hover:underline" data-testid="link-view-all-plans">
              View all plans
            </Link>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
