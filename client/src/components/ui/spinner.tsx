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
      className={cn("relative", sizeClasses[size], className)}
      role="status"
      aria-label="Loading"
      data-testid="spinner"
    >
      <svg className="animate-spin" viewBox="0 0 50 50">
        <defs>
          <linearGradient id="spinner-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="50%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
        </defs>
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="opacity-10"
        />
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="url(#spinner-gradient)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="80, 200"
        />
      </svg>
    </div>
  );
}

export function PageSpinner({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-6" data-testid="page-spinner">
      <div className="relative">
        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-500 via-purple-500 to-pink-500 animate-spin p-[3px]">
          <div className="w-full h-full rounded-full bg-background" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse" />
        </div>
      </div>
      {message && (
        <p className="text-sm text-muted-foreground animate-pulse">{message}</p>
      )}
    </div>
  );
}

export function DotsSpinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1.5", className)} data-testid="dots-spinner">
      <div className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 animate-bounce [animation-delay:-0.3s]" />
      <div className="w-2 h-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 animate-bounce [animation-delay:-0.15s]" />
      <div className="w-2 h-2 rounded-full bg-gradient-to-r from-orange-500 to-red-500 animate-bounce" />
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

  const colors = [
    "bg-blue-500",
    "bg-cyan-500", 
    "bg-teal-500",
    "bg-emerald-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-rose-500",
    "bg-orange-500",
  ];
  
  return (
    <div 
      className={cn("relative", sizeMap[size].container, className)} 
      role="status" 
      aria-label="Loading"
      data-testid="segmented-spinner"
    >
      {colors.map((color, i) => (
        <div
          key={i}
          className={cn(
            "absolute left-1/2 top-0 -translate-x-1/2 rounded-full",
            color,
            sizeMap[size].segment
          )}
          style={{
            transform: `translateX(-50%) rotate(${i * 45}deg)`,
            transformOrigin: `50% calc(${size === "sm" ? "10px" : size === "md" ? "16px" : size === "lg" ? "20px" : "28px"})`,
            animation: `segmented-spin 0.8s linear infinite`,
            animationDelay: `${-i * 0.1}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes segmented-spin {
          0% { opacity: 1; transform: translateX(-50%) rotate(var(--base-rotation)) scale(1); }
          50% { opacity: 0.5; transform: translateX(-50%) rotate(var(--base-rotation)) scale(0.8); }
          100% { opacity: 0.15; transform: translateX(-50%) rotate(var(--base-rotation)) scale(0.6); }
        }
      `}</style>
    </div>
  );
}
