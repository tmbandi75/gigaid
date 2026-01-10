import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageSquareText, CreditCard, BellRing } from "lucide-react";
import { motion } from "framer-motion";
import gigaidLogo from "@assets/image_1768065147961.png";

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
  onStart: () => void;
}

export function WelcomeModal({ open, onClose, onStart }: WelcomeModalProps) {
  const features = [
    {
      icon: MessageSquareText,
      title: "Turn Messages into Jobs",
      description: "We turn client texts into scheduled work automatically",
      gradient: "from-blue-500 to-cyan-400",
      bgGlow: "bg-blue-500/20",
    },
    {
      icon: CreditCard,
      title: "Get Paid Faster",
      description: "Send booking links with upfront or on-completion payments",
      gradient: "from-emerald-500 to-teal-400",
      bgGlow: "bg-emerald-500/20",
    },
    {
      icon: BellRing,
      title: "Never Miss a Job",
      description: "Automatic reminders for you and your clients",
      gradient: "from-violet-500 to-purple-400",
      bgGlow: "bg-violet-500/20",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-md p-0 overflow-hidden border-0 bg-gradient-to-b from-background to-muted/50" 
        data-testid="dialog-welcome"
      >
        <div className="relative">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-primary/30 to-violet-500/30 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full blur-2xl" />
            <div className="absolute top-1/2 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-full blur-2xl" />
          </div>

          <div className="relative px-6 pt-8 pb-6">
            <div className="text-center mb-6">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="mb-4"
              >
                <img 
                  src={gigaidLogo} 
                  alt="GigAid" 
                  className="h-12 mx-auto"
                />
              </motion.div>

              <motion.h1
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="text-xl font-bold text-foreground"
              >
                Welcome to GigAid</motion.h1>

              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.3 }}
                className="text-lg font-semibold text-primary mt-2"
              >
                Book jobs. Get paid. Done.
              </motion.p>

              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.4 }}
                className="text-sm text-muted-foreground mt-3 leading-relaxed"
              >
                <span className="font-semibold text-foreground">GigAid<sup className="text-xs">™</sup></span> turns texts and calls into booked jobs with automatic reminders and payments — so you can focus on the work, not the admin.
              </motion.p>
            </div>

            <div className="space-y-3">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.5 + index * 0.1 }}
                  className="flex items-start gap-4 p-3 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover-elevate transition-all duration-200"
                >
                  <div className={`relative p-2.5 rounded-xl bg-gradient-to-br ${feature.gradient} shadow-lg`}>
                    <feature.icon className="w-5 h-5 text-white" />
                    <div className={`absolute inset-0 rounded-xl ${feature.bgGlow} blur-md -z-10`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{feature.title}</p>
                    <p className="text-sm text-muted-foreground leading-snug">{feature.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.8 }}
              className="mt-6"
            >
              <Button 
                onClick={onStart} 
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary via-primary to-violet-600 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300" 
                data-testid="button-get-started"
              >
                Get Started
              </Button>
              <p className="text-center text-xs text-muted-foreground mt-3">
                Takes less than 2 minutes to set up
              </p>
            </motion.div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
