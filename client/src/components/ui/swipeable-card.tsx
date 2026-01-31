import { useState, useRef, useCallback } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Archive, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SwipeAction {
  id: string;
  label: string;
  icon: "Archive" | "Trash2" | "X";
  variant: "destructive" | "secondary" | "warning";
  onClick: () => void;
}

interface SwipeableCardProps {
  children: React.ReactNode;
  actions: SwipeAction[];
  onActionTriggered?: (actionId: string) => void;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
}

const SWIPE_THRESHOLD = 80;
const ACTION_BUTTON_WIDTH = 72;

const iconMap = {
  Archive,
  Trash2,
  X,
};

const variantStyles = {
  destructive: "bg-destructive text-destructive-foreground",
  secondary: "bg-muted text-muted-foreground",
  warning: "bg-amber-500 text-white",
};

export function SwipeableCard({
  children,
  actions,
  onActionTriggered,
  disabled = false,
  className,
  "data-testid": testId,
}: SwipeableCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  
  const totalActionsWidth = actions.length * ACTION_BUTTON_WIDTH;
  
  const actionOpacity = useTransform(
    x,
    [-totalActionsWidth, -SWIPE_THRESHOLD / 2, 0],
    [1, 0.5, 0]
  );

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (disabled) return;
      
      const shouldOpen = info.offset.x < -SWIPE_THRESHOLD;
      const shouldClose = info.offset.x > SWIPE_THRESHOLD / 2;
      
      if (shouldOpen) {
        setIsOpen(true);
      } else if (shouldClose) {
        setIsOpen(false);
      }
    },
    [disabled]
  );

  const handleActionClick = (action: SwipeAction) => {
    action.onClick();
    onActionTriggered?.(action.id);
    setIsOpen(false);
  };

  const closeActions = () => {
    setIsOpen(false);
  };

  if (actions.length === 0) {
    return (
      <div className={className} data-testid={testId}>
        {children}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden", className)}
      data-testid={testId}
    >
      <div
        className="absolute right-0 top-0 bottom-0 flex items-stretch"
        style={{ width: totalActionsWidth }}
      >
        {actions.map((action, index) => {
          const Icon = iconMap[action.icon];
          return (
            <motion.button
              key={action.id}
              style={{ opacity: actionOpacity, width: ACTION_BUTTON_WIDTH }}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-xs font-medium",
                variantStyles[action.variant]
              )}
              onClick={() => handleActionClick(action)}
              data-testid={`swipe-action-${action.id}`}
            >
              <Icon className="h-5 w-5" />
              <span>{action.label}</span>
            </motion.button>
          );
        })}
      </div>

      <motion.div
        drag={disabled ? false : "x"}
        dragDirectionLock
        dragConstraints={{ left: -totalActionsWidth, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        animate={{ x: isOpen ? -totalActionsWidth : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 40 }}
        style={{ x }}
        className="relative bg-background"
        onClick={isOpen ? closeActions : undefined}
      >
        {children}
      </motion.div>
    </div>
  );
}
