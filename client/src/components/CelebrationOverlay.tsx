import { motion, AnimatePresence } from "framer-motion";
import { X, PartyPopper, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";

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
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md"
          data-testid="celebration-overlay"
        >
          <div className="relative rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 p-4 shadow-xl">
            <Button
              size="icon"
              variant="ghost"
              onClick={onDismiss}
              className="absolute right-2 top-2 h-8 w-8 text-white/80 hover:text-white hover:bg-white/20"
              data-testid="button-dismiss-celebration"
            >
              <X className="h-4 w-4" />
            </Button>

            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                {type === "job_booked" ? (
                  <PartyPopper className="h-6 w-6 text-white" />
                ) : (
                  <DollarSign className="h-6 w-6 text-white" />
                )}
              </div>
              <div className="flex-1 pr-6">
                <h3 className="text-lg font-semibold text-white">
                  {type === "job_booked" ? "Job Booked!" : "Payment Received!"}
                </h3>
                <p className="mt-1 text-sm text-white/90" data-testid="text-celebration-message">
                  {message}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
