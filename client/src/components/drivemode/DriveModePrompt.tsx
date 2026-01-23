import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface DriveModePromptProps {
  open: boolean;
  onSwitch: () => void;
  onNotNow: () => void;
}

export function DriveModePrompt({ open, onSwitch, onNotNow }: DriveModePromptProps) {
  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onNotNow()}>
      <SheetContent side="bottom" className="rounded-t-xl">
        <SheetHeader className="text-center pb-4">
          <SheetTitle className="text-lg font-semibold">
            Looks like you're on the move. Switch to Drive Mode?
          </SheetTitle>
        </SheetHeader>
        <div className="flex gap-3 pb-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onNotNow}
            data-testid="button-drive-mode-not-now"
          >
            Not now
          </Button>
          <Button
            className="flex-1"
            onClick={onSwitch}
            data-testid="button-drive-mode-switch"
          >
            Switch
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
