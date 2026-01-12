import { useState, useCallback } from "react";
import confetti from "canvas-confetti";
import { apiRequest } from "@/lib/queryClient";

type CelebrationType = "job_booked" | "payment_received";

interface CelebrationContext {
  type: CelebrationType;
  jobTitle?: string;
  clientName?: string;
  amount?: number;
  serviceName?: string;
}

interface CelebrationState {
  isVisible: boolean;
  message: string;
  type: CelebrationType | null;
}

export function useCelebration() {
  const [celebration, setCelebration] = useState<CelebrationState>({
    isVisible: false,
    message: "",
    type: null,
  });

  const triggerConfetti = useCallback(() => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    const randomInRange = (min: number, max: number) =>
      Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }
      const particleCount = 50 * (timeLeft / duration);
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      });
    }, 250);
  }, []);

  const celebrate = useCallback(
    async (context: CelebrationContext) => {
      triggerConfetti();

      try {
        const response = await apiRequest("POST", "/api/celebrate", context);
        const data = await response.json();
        
        setCelebration({
          isVisible: true,
          message: data.message,
          type: context.type,
        });
      } catch {
        const fallbackMessage =
          context.type === "job_booked"
            ? "Another job in the books! Your hard work is paying off!"
            : "Payment received! Great work!";
        
        setCelebration({
          isVisible: true,
          message: fallbackMessage,
          type: context.type,
        });
      }

      setTimeout(() => {
        setCelebration((prev) => ({ ...prev, isVisible: false }));
      }, 5000);
    },
    [triggerConfetti]
  );

  const dismiss = useCallback(() => {
    setCelebration((prev) => ({ ...prev, isVisible: false }));
  }, []);

  return {
    celebration,
    celebrate,
    dismiss,
  };
}
