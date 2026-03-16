import { Loader2, MessageSquare, User, Wrench } from "lucide-react";
import { motion } from "framer-motion";

const STEPS = [
  { icon: MessageSquare, label: "Analyzing message..." },
  { icon: User, label: "Extracting contact information..." },
  { icon: Wrench, label: "Identifying service request..." },
];

export function ExtractionLoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-6">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
      >
        <Loader2 className="h-10 w-10 text-primary" />
      </motion.div>
      <div className="space-y-3 text-center">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.6 }}
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Icon className="h-4 w-4" />
              <span>{step.label}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
