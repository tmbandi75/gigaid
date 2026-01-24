import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

type SoftInterceptProps = {
  title: string;
  description: string;
  primaryActionLabel: string;
  secondaryActionLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
  "data-testid"?: string;
};

export function SoftIntercept({
  title,
  description,
  primaryActionLabel,
  secondaryActionLabel,
  onPrimary,
  onSecondary,
  "data-testid": testId
}: SoftInterceptProps) {
  return (
    <Card 
      className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
      data-testid={testId}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-900 dark:text-amber-100">
              {title}
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              {description}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Button
                size="sm"
                onClick={onPrimary}
                className="bg-amber-600 hover-elevate active-elevate-2 text-white"
                data-testid={testId ? `${testId}-primary` : "soft-intercept-primary"}
              >
                {primaryActionLabel}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onSecondary}
                className="text-amber-700 dark:text-amber-300"
                data-testid={testId ? `${testId}-secondary` : "soft-intercept-secondary"}
              >
                {secondaryActionLabel}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
