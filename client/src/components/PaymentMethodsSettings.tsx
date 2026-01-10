import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  DollarSign, 
  CreditCard, 
  Smartphone, 
  Banknote,
  FileText,
  Loader2,
  Save,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { SiVenmo, SiCashapp } from "react-icons/si";

type PaymentMethodType = "zelle" | "venmo" | "cashapp" | "cash" | "check" | "stripe";

interface PaymentMethodConfig {
  type: PaymentMethodType;
  label: string;
  icon: React.ReactNode;
  hasInstructions: boolean;
  description: string;
}

const PAYMENT_METHODS: PaymentMethodConfig[] = [
  {
    type: "zelle",
    label: "Zelle",
    icon: <Smartphone className="h-5 w-5" />,
    hasInstructions: true,
    description: "Accept payments via Zelle transfer",
  },
  {
    type: "venmo",
    label: "Venmo",
    icon: <SiVenmo className="h-5 w-5" />,
    hasInstructions: true,
    description: "Accept payments via Venmo",
  },
  {
    type: "cashapp",
    label: "Cash App",
    icon: <SiCashapp className="h-5 w-5" />,
    hasInstructions: true,
    description: "Accept payments via Cash App",
  },
  {
    type: "cash",
    label: "Cash",
    icon: <Banknote className="h-5 w-5" />,
    hasInstructions: false,
    description: "Accept cash payments in person",
  },
  {
    type: "check",
    label: "Check",
    icon: <FileText className="h-5 w-5" />,
    hasInstructions: true,
    description: "Accept check payments",
  },
  {
    type: "stripe",
    label: "Card (Stripe)",
    icon: <CreditCard className="h-5 w-5" />,
    hasInstructions: false,
    description: "Accept card payments via Stripe",
  },
];

interface UserPaymentMethod {
  id: string;
  userId: string;
  type: PaymentMethodType;
  label: string | null;
  instructions: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string | null;
}

interface MethodState {
  isEnabled: boolean;
  instructions: string;
  customLabel: string;
}

export function PaymentMethodsSettings() {
  const { toast } = useToast();
  const [expandedMethod, setExpandedMethod] = useState<PaymentMethodType | null>(null);
  const [methodStates, setMethodStates] = useState<Record<PaymentMethodType, MethodState>>(() => {
    const initial: Record<string, MethodState> = {};
    PAYMENT_METHODS.forEach((m) => {
      initial[m.type] = { isEnabled: false, instructions: "", customLabel: "" };
    });
    return initial as Record<PaymentMethodType, MethodState>;
  });

  const { data: savedMethods, isLoading } = useQuery<UserPaymentMethod[]>({
    queryKey: ["/api/payment-methods"],
    refetchOnMount: true,
  });

  const hasSynced = useRef(false);

  const updateMethodState = (type: PaymentMethodType, updates: Partial<MethodState>) => {
    setMethodStates((prev) => ({
      ...prev,
      [type]: { ...prev[type], ...updates },
    }));
  };

  useEffect(() => {
    if (savedMethods && !hasSynced.current) {
      hasSynced.current = true;
      const newStates: Record<string, MethodState> = {};
      PAYMENT_METHODS.forEach((m) => {
        newStates[m.type] = { isEnabled: false, instructions: "", customLabel: "" };
      });
      savedMethods.forEach((method) => {
        if (newStates[method.type]) {
          newStates[method.type] = {
            isEnabled: method.isEnabled,
            instructions: method.instructions || "",
            customLabel: method.label || "",
          };
        }
      });
      setMethodStates(newStates as Record<PaymentMethodType, MethodState>);
    }
  }, [savedMethods]);

  const bulkUpdateMutation = useMutation({
    mutationFn: async (methods: { type: PaymentMethodType; label: string | null; instructions: string | null; isEnabled: boolean }[]) => {
      const response = await apiRequest("POST", "/api/payment-methods/bulk-update", { methods });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
      toast({
        title: "Settings saved",
        description: "Your payment methods have been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save payment settings.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const methods = PAYMENT_METHODS.map((m) => ({
      type: m.type,
      label: methodStates[m.type].customLabel || null,
      instructions: methodStates[m.type].instructions || null,
      isEnabled: methodStates[m.type].isEnabled,
    }));
    bulkUpdateMutation.mutate(methods);
  };

  const toggleMethod = (type: PaymentMethodType) => {
    const current = methodStates[type].isEnabled;
    updateMethodState(type, { isEnabled: !current });
  };

  const toggleExpand = (type: PaymentMethodType) => {
    setExpandedMethod((prev) => (prev === type ? null : type));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-lg">Payment Methods</CardTitle>
            <p className="text-sm text-muted-foreground">
              Configure how clients can pay you
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {PAYMENT_METHODS.map((method) => {
          const state = methodStates[method.type];
          const isExpanded = expandedMethod === method.type;

          return (
            <div
              key={method.type}
              className={`rounded-xl border transition-all ${
                state.isEnabled 
                  ? "border-primary/30 bg-primary/5" 
                  : "border-border bg-card"
              }`}
              data-testid={`payment-method-${method.type}`}
            >
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                    state.isEnabled 
                      ? "bg-primary/20 text-primary" 
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {method.icon}
                  </div>
                  <div>
                    <div className="font-medium">{method.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {method.description}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {method.hasInstructions && state.isEnabled && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleExpand(method.type)}
                      data-testid={`button-expand-${method.type}`}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  <Switch
                    checked={state.isEnabled}
                    onCheckedChange={() => toggleMethod(method.type)}
                    data-testid={`switch-${method.type}`}
                  />
                </div>
              </div>

              {method.hasInstructions && state.isEnabled && isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t pt-3">
                  <div className="space-y-2">
                    <Label htmlFor={`${method.type}-instructions`}>
                      Payment Instructions
                    </Label>
                    <Textarea
                      id={`${method.type}-instructions`}
                      placeholder={getPlaceholder(method.type)}
                      value={state.instructions}
                      onChange={(e) =>
                        updateMethodState(method.type, {
                          instructions: e.target.value,
                        })
                      }
                      className="resize-none text-sm"
                      rows={2}
                      data-testid={`input-instructions-${method.type}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${method.type}-label`}>
                      Display Name (optional)
                    </Label>
                    <Input
                      id={`${method.type}-label`}
                      placeholder={`e.g., "My ${method.label}"`}
                      value={state.customLabel}
                      onChange={(e) =>
                        updateMethodState(method.type, {
                          customLabel: e.target.value,
                        })
                      }
                      data-testid={`input-label-${method.type}`}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <Button
          onClick={handleSave}
          disabled={bulkUpdateMutation.isPending}
          className="w-full mt-4"
          data-testid="button-save-payment-methods"
        >
          {bulkUpdateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Payment Settings
        </Button>
      </CardContent>
    </Card>
  );
}

function getPlaceholder(type: PaymentMethodType): string {
  switch (type) {
    case "zelle":
      return "Send payment to: yourname@email.com";
    case "venmo":
      return "Send to: @your-venmo-handle";
    case "cashapp":
      return "Send to: $YourCashtag";
    case "check":
      return "Make check payable to: Your Business Name";
    default:
      return "Enter payment instructions";
  }
}
