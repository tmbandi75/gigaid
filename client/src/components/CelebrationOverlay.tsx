import { motion, AnimatePresence } from "framer-motion";
import { X, PartyPopper, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import Lottie from "lottie-react";
import celebrationAnimation from "@/assets/celebration-lottie.json";

interface CelebrationOverlayProps {
  isVisible: boolean;
  message: string;
  type: "job_booked" | "payment_received" | null;
  onDismiss: () => void;
}

export function CelebrationOverlay({
  isVisible,
  message,
  type,
  onDismiss,
}: CelebrationOverlayProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Full-screen Lottie animation overlay - only for payments */}
          {type === "payment_received" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center"
              data-testid="celebration-lottie-overlay"
            >
              <Lottie
                animationData={celebrationAnimation}
                loop={false}
                className="w-full h-full max-w-lg max-h-lg"
              />
            </motion.div>
          )}

          {/* Message card */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md"
            data-testid="celebration-overlay"
          >
            <div className="relative rounded-md bg-primary p-4 shadow-xl">
              <Button
                size="icon"
                variant="ghost"
                onClick={onDismiss}
                className="absolute right-2 top-2 text-primary-foreground/80"
                data-testid="button-dismiss-celebration"
              >
                <X className="h-4 w-4" />
              </Button>

              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-foreground/20">
                  {type === "job_booked" ? (
                    <PartyPopper className="h-6 w-6 text-primary-foreground" />
                  ) : (
                    <DollarSign className="h-6 w-6 text-primary-foreground" />
                  )}
                </div>
                <div className="flex-1 pr-6">
                  <h3 className="text-lg font-semibold text-primary-foreground">
                    {type === "job_booked" ? "Job Booked!" : "Payment Received!"}
                  </h3>
                  <p className="mt-1 text-sm text-primary-foreground/90" data-testid="text-celebration-message">
                    {message}
                  </p>
                  <p className="mt-2 text-xs text-primary-foreground/70 italic" data-testid="text-gigaid-helped">
                    {type === "payment_received" 
                      ? "GigAid helped you collect this faster." 
                      : "GigAid helped you secure this opportunity."}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
