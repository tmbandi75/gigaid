import { Bell, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TopBarProps {
  title: string;
  showActions?: boolean;
}

export function TopBar({ title, showActions = true }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
      <div className="flex items-center justify-between h-14 px-4">
        <h1 className="text-xl font-medium text-foreground tracking-tight">
          {title}
        </h1>
        
        {showActions && (
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              data-testid="button-notifications"
              className="text-muted-foreground"
            >
              <Bell className="h-5 w-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              data-testid="button-settings"
              className="text-muted-foreground"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
