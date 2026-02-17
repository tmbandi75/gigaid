import { useState, useEffect, type ReactNode } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface SecondaryActionsPanelProps {
  children: ReactNode;
  className?: string;
}

export function SecondaryActionsPanel({ children, className }: SecondaryActionsPanelProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(!isMobile);

  useEffect(() => {
    setOpen(!isMobile);
  }, [isMobile]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full flex items-center justify-between gap-2 text-muted-foreground"
          data-testid="button-toggle-secondary-actions"
        >
          <span className="text-sm font-semibold uppercase tracking-wide">
            {open ? "Dashboard" : "More tools"}
          </span>
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-6 pt-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
