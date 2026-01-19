import { cn } from "@/lib/utils";

interface SpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
  xl: "w-12 h-12",
};

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <div
      className={cn("relative text-primary", sizeClasses[size], className)}
      role="status"
      aria-label="Loading"
      data-testid="spinner"
    >
      <svg
        className="animate-spin"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          className="opacity-20"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          d="M12 2C6.47715 2 2 6.47715 2 12C2 14.5361 2.94409 16.8517 4.5 18.6"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export function PageSpinner({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-4" data-testid="page-spinner">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-4 border-primary/20" />
        <div className="absolute inset-0 w-12 h-12 rounded-full border-4 border-transparent border-t-primary animate-spin" />
      </div>
      {message && (
        <p className="text-sm text-muted-foreground animate-pulse">{message}</p>
      )}
    </div>
  );
}

export function DotsSpinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)} data-testid="dots-spinner">
      <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
      <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
    </div>
  );
}

export function SegmentedSpinner({ size = "md", className }: SpinnerProps) {
  const sizeMap = {
    sm: { container: "w-5 h-5", segment: "w-1 h-1.5" },
    md: { container: "w-8 h-8", segment: "w-1.5 h-2" },
    lg: { container: "w-10 h-10", segment: "w-2 h-2.5" },
    xl: { container: "w-14 h-14", segment: "w-2.5 h-3" },
  };

  const segments = 8;
  
  return (
    <div 
      className={cn("relative", sizeMap[size].container, className)} 
      role="status" 
      aria-label="Loading"
      data-testid="segmented-spinner"
    >
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "absolute left-1/2 top-0 -translate-x-1/2 rounded-full bg-primary origin-[center_calc(var(--container-size)/2)]",
            sizeMap[size].segment
          )}
          style={{
            transform: `translateX(-50%) rotate(${i * (360 / segments)}deg)`,
            transformOrigin: `50% calc(${size === "sm" ? "10px" : size === "md" ? "16px" : size === "lg" ? "20px" : "28px"})`,
            opacity: 0.15 + (i / segments) * 0.85,
            animation: `segmented-spin 0.8s linear infinite`,
            animationDelay: `${-i * (0.8 / segments)}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes segmented-spin {
          0% { opacity: 1; }
          100% { opacity: 0.15; }
        }
      `}</style>
    </div>
  );
}
