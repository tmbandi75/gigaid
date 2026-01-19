import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, X, Loader2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import type { ReadyAction } from "@shared/schema";

interface IntentActionCardProps {
  entityType: "lead" | "job";
  entityId: string;
}

export function IntentActionCard({ entityType, entityId }: IntentActionCardProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const { data: action, isLoading } = useQuery<ReadyAction | null>({
    queryKey: ["/api/ready-actions/entity", entityType, entityId],
    queryFn: async () => {
      const res = await fetch(`/api/ready-actions/entity/${entityType}/${entityId}`);
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 30000,
  });
  
  const actMutation = useMutation({
    mutationFn: async (actionId: string) => {
      return apiRequest("POST", `/api/ready-actions/${actionId}/act`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ready-actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Invoice created!",
        description: "Your invoice is ready. Tap to send it.",
      });
      if (data.invoice?.id) {
        setLocation(`/invoices/${data.invoice.id}`);
      }
    },
    onError: () => {
      toast({
        title: "Something went wrong",
        description: "Couldn't create the invoice. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  const dismissMutation = useMutation({
    mutationFn: async (actionId: string) => {
      return apiRequest("POST", `/api/ready-actions/${actionId}/dismiss`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ready-actions"] });
    },
  });
  
  if (isLoading || !action) {
    return null;
  }
  
  const formattedAmount = action.prefilledAmount 
    ? `$${(action.prefilledAmount / 100).toFixed(0)}` 
    : null;
  
  return (
    <Card 
      className="border-0 shadow-xl overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
      data-testid="card-intent-action"
    >
      <CardContent className="p-0">
        <div className="relative">
          <button
            onClick={() => dismissMutation.mutate(action.id)}
            className="absolute top-3 right-3 p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            aria-label="Dismiss"
            data-testid="button-dismiss-intent"
          >
            <X className="h-4 w-4" />
          </button>
          
          <div className="p-5 space-y-4">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold leading-tight" data-testid="text-intent-headline">
                {action.headline}
              </h3>
              <p className="text-sm text-white/80" data-testid="text-intent-subtext">
                {action.subtext}
              </p>
            </div>
            
            <div className="bg-white/10 rounded-lg p-3 space-y-2">
              {action.prefilledClientName && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/70">Client</span>
                  <span className="font-medium" data-testid="text-prefilled-client">
                    {action.prefilledClientName}
                  </span>
                </div>
              )}
              {formattedAmount && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/70">Amount</span>
                  <span className="font-semibold text-lg" data-testid="text-prefilled-amount">
                    {formattedAmount}
                  </span>
                </div>
              )}
              {action.prefilledServiceType && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/70">Service</span>
                  <span className="font-medium truncate max-w-[180px]" data-testid="text-prefilled-service">
                    {action.prefilledServiceType}
                  </span>
                </div>
              )}
              {action.prefilledDueDate && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/70">Due</span>
                  <span className="font-medium" data-testid="text-prefilled-due">
                    {new Date(action.prefilledDueDate).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
            
            <Button
              onClick={() => actMutation.mutate(action.id)}
              disabled={actMutation.isPending}
              className="w-full h-12 text-base font-semibold bg-white text-emerald-600 hover:bg-white/90 shadow-lg"
              data-testid="button-send-get-paid"
            >
              {actMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <DollarSign className="h-5 w-5 mr-2" />
              )}
              {action.ctaLabel}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function IntentActionsList() {
  const { data: actions, isLoading } = useQuery<ReadyAction[]>({
    queryKey: ["/api/ready-actions"],
  });
  
  if (isLoading || !actions?.length) {
    return null;
  }
  
  return (
    <div className="space-y-4" data-testid="list-intent-actions">
      {actions.slice(0, 3).map((action) => (
        <IntentActionCardStandalone key={action.id} action={action} />
      ))}
    </div>
  );
}

function IntentActionCardStandalone({ action }: { action: ReadyAction }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const actMutation = useMutation({
    mutationFn: async (actionId: string) => {
      return apiRequest("POST", `/api/ready-actions/${actionId}/act`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ready-actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Invoice created!",
        description: "Your invoice is ready. Tap to send it.",
      });
      if (data.invoice?.id) {
        setLocation(`/invoices/${data.invoice.id}`);
      }
    },
    onError: () => {
      toast({
        title: "Something went wrong",
        description: "Couldn't create the invoice. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  const dismissMutation = useMutation({
    mutationFn: async (actionId: string) => {
      return apiRequest("POST", `/api/ready-actions/${actionId}/dismiss`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ready-actions"] });
    },
  });
  
  const formattedAmount = action.prefilledAmount 
    ? `$${(action.prefilledAmount / 100).toFixed(0)}` 
    : null;
  
  return (
    <Card 
      className="border-0 shadow-xl overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
      data-testid={`card-intent-action-${action.id}`}
    >
      <CardContent className="p-0">
        <div className="relative">
          <button
            onClick={() => dismissMutation.mutate(action.id)}
            className="absolute top-3 right-3 p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            aria-label="Dismiss"
            data-testid={`button-dismiss-${action.id}`}
          >
            <X className="h-4 w-4" />
          </button>
          
          <div className="p-5 space-y-4">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold leading-tight">
                {action.headline}
              </h3>
              <p className="text-sm text-white/80">
                {action.subtext}
              </p>
            </div>
            
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                {action.prefilledClientName && (
                  <p className="font-medium truncate">{action.prefilledClientName}</p>
                )}
                {formattedAmount && (
                  <p className="text-2xl font-bold">{formattedAmount}</p>
                )}
              </div>
              
              <Button
                onClick={() => actMutation.mutate(action.id)}
                disabled={actMutation.isPending}
                size="lg"
                className="flex-shrink-0 font-semibold bg-white text-emerald-600 hover:bg-white/90 shadow-lg"
                data-testid={`button-act-${action.id}`}
              >
                {actMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  action.ctaLabel
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
