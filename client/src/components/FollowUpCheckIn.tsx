import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageSquare, 
  Clock, 
  XCircle,
  CheckCircle2,
  User,
  ChevronRight,
  Sparkles
} from "lucide-react";
import type { Lead } from "@shared/schema";

interface FollowUpCheckInProps {
  onActionComplete?: () => void;
}

export default function FollowUpCheckIn({ onActionComplete }: FollowUpCheckInProps) {
  const { toast } = useToast();

  const { data: leadsNeedingFollowUp = [], isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads/follow-up-needed"],
    refetchInterval: 60000,
  });

  const followUpMutation = useMutation({
    mutationFn: async ({ leadId, response }: { leadId: string; response: string }) => {
      const res = await apiRequest("POST", `/api/leads/${leadId}/follow-up-response`, { response });
      return res.json();
    },
    onSuccess: (_, { response }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads/follow-up-needed"] });
      
      const messages = {
        replied: "Great! Lead marked as engaged",
        waiting: "We'll check again in 24 hours",
        no_response: "Lead archived as cold",
      };
      
      toast({
        title: messages[response as keyof typeof messages] || "Updated",
      });
      
      onActionComplete?.();
    },
  });

  if (isLoading || leadsNeedingFollowUp.length === 0) {
    return null;
  }

  return (
    <AnimatePresence>
      {leadsNeedingFollowUp.map((lead, index) => (
        <motion.div
          key={lead.id}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10, height: 0 }}
          transition={{ delay: index * 0.1 }}
          className="mb-4"
          data-testid={`follow-up-card-${lead.id}`}
        >
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 rounded-xl bg-amber-500/20 shrink-0">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-amber-700 dark:text-amber-300">
                  Quick check-in
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <User className="w-4 h-4 text-muted-foreground shrink-0" />
                  <p className="font-semibold truncate">{lead.clientName}</p>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5 truncate">
                  {lead.serviceType} • {lead.source}
                </p>
              </div>
            </div>

            <p className="text-center text-sm font-medium mb-4">
              Did they reply?
            </p>

            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => followUpMutation.mutate({ leadId: lead.id, response: "replied" })}
                disabled={followUpMutation.isPending}
                className="flex flex-col items-center gap-1 h-auto py-3 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950/30"
                data-testid={`button-replied-${lead.id}`}
              >
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                <span className="text-xs font-medium">Yes</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => followUpMutation.mutate({ leadId: lead.id, response: "waiting" })}
                disabled={followUpMutation.isPending}
                className="flex flex-col items-center gap-1 h-auto py-3 border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                data-testid={`button-waiting-${lead.id}`}
              >
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-medium">Not yet</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => followUpMutation.mutate({ leadId: lead.id, response: "no_response" })}
                disabled={followUpMutation.isPending}
                className="flex flex-col items-center gap-1 h-auto py-3 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30"
                data-testid={`button-no-response-${lead.id}`}
              >
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <span className="text-xs font-medium">No</span>
              </Button>
            </div>
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
