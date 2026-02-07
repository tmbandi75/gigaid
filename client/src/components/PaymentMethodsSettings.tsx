import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { useApiMutation } from "@/hooks/useApiMutation";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Pencil,
} from "lucide-react";
import { SiVenmo, SiCashapp } from "react-icons/si";

type PaymentMethodType = "zelle" | "venmo" | "cashapp" | "cash" | "check" | "stripe";

interface PaymentMethodConfig {
  type: PaymentMethodType;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  hasInstructions: boolean;
  description: string;
}

const PAYMENT_METHODS: PaymentMethodConfig[] = [
  {
    type: "zelle",
    label: "Zelle",
    shortLabel: "Zelle",
    icon: <Smartphone className="h-4 w-4" />,
    hasInstructions: true,
    description: "Accept payments via Zelle transfer",
  },
  {
    type: "venmo",
    label: "Venmo",
    shortLabel: "Venmo",
    icon: <SiVenmo className="h-4 w-4" />,
    hasInstructions: true,
    description: "Accept payments via Venmo",
  },
  {
    type: "cashapp",
    label: "Cash App",
    shortLabel: "CashApp",
    icon: <SiCashapp className="h-4 w-4" />,
    hasInstructions: true,
    description: "Accept payments via Cash App",
  },
  {
    type: "cash",
    label: "Cash",
    shortLabel: "Cash",
    icon: <Banknote className="h-4 w-4" />,
    hasInstructions: false,
    description: "Accept cash payments in person",
  },
  {
    type: "check",
    label: "Check",
    shortLabel: "Check",
    icon: <FileText className="h-4 w-4" />,
    hasInstructions: true,
    description: "Accept check payments",
  },
  {
    type: "stripe",
    label: "Card (Stripe)",
    shortLabel: "Card",
    icon: <CreditCard className="h-4 w-4" />,
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

interface PaymentMethodsSettingsProps {
  onStripeToggle?: (enabled: boolean) => void;
}

export function PaymentMethodsSettings({ onStripeToggle }: PaymentMethodsSettingsProps = {}) {
  const { toast } = useToast();
  const [showDetails, setShowDetails] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType | null>(null);
  const [methodStates, setMethodStates] = useState<Record<PaymentMethodType, MethodState>>(() => {
    const initial: Record<string, MethodState> = {};
    PAYMENT_METHODS.forEach((m) => {
      initial[m.type] = { isEnabled: false, instructions: "", customLabel: "" };
    });
    return initial as Record<PaymentMethodType, MethodState>;
  });

  const { data: savedMethods, isLoading } = useQuery<UserPaymentMethod[]>({
    queryKey: QUERY_KEYS.paymentMethods(),
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

  const bulkUpdateMutation = useApiMutation(
    async (methods: { type: PaymentMethodType; label: string | null; instructions: string | null; isEnabled: boolean }[]) => {
      return apiFetch("/api/payment-methods/bulk-update", {
        method: "POST",
        body: JSON.stringify({ methods }),
      });
    },
    [QUERY_KEYS.paymentMethods()],
    {
      onSuccess: () => {
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
    }
  );

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
    const newEnabled = !current;
    updateMethodState(type, { isEnabled: newEnabled });
    
    if (type === "stripe" && onStripeToggle) {
      onStripeToggle(newEnabled);
    }
  };

  const enabledMethods = PAYMENT_METHODS.filter(m => methodStates[m.type].isEnabled);

  const getSummary = () => {
    if (enabledMethods.length === 0) return "No payment methods enabled";
    return `Accepting: ${enabledMethods.map(m => m.shortLabel).join(", ")}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="border-0 shadow-md" data-testid="card-payment-methods">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shrink-0">
              <DollarSign className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">Payment Methods</CardTitle>
              <CardDescription className="text-xs">How clients can pay you</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {/* Payment Method Toggle Buttons */}
        <div className="space-y-2">
          <Label className="text-sm">Accept payments via</Label>
          <div className="flex flex-wrap gap-1.5" data-testid="payment-methods-pills">
            {PAYMENT_METHODS.map((method) => {
              const state = methodStates[method.type];
              return (
                <Button
                  key={method.type}
                  type="button"
                  variant={state.isEnabled ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => toggleMethod(method.type)}
                  data-testid={`button-toggle-${method.type}`}
                  aria-pressed={state.isEnabled}
                >
                  {method.icon}
                  {method.shortLabel}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Summary & Edit Toggle */}
        <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/30 border">
          <p className="text-sm text-muted-foreground flex-1 min-w-0 truncate">
            {getSummary()}
          </p>
          {enabledMethods.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const newShowDetails = !showDetails;
                setShowDetails(newShowDetails);
                if (newShowDetails && enabledMethods.length > 0) {
                  setSelectedMethod(enabledMethods[0].type);
                } else {
                  setSelectedMethod(null);
                }
              }}
              className="shrink-0"
              data-testid="button-toggle-details"
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              {showDetails ? "Done" : "Edit Details"}
              {showDetails ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
            </Button>
          )}
        </div>

        {/* Expanded Details Editor */}
        {showDetails && enabledMethods.length > 0 && (
          <div className="p-3 rounded-lg border bg-background space-y-3" data-testid="payment-details-editor">
            {/* Method selector tabs */}
            <div className="flex flex-wrap gap-1.5">
              {enabledMethods.map((method) => {
                const isSelected = selectedMethod === method.type;
                return (
                  <Button
                    key={method.type}
                    type="button"
                    variant={isSelected ? "default" : "secondary"}
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => setSelectedMethod(method.type)}
                    data-testid={`button-select-${method.type}`}
                  >
                    {method.icon}
                    {method.shortLabel}
                  </Button>
                );
              })}
            </div>

            {selectedMethod && (
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center justify-between gap-2">
                  <Label className="font-medium flex items-center gap-2">
                    {PAYMENT_METHODS.find(m => m.type === selectedMethod)?.icon}
                    {PAYMENT_METHODS.find(m => m.type === selectedMethod)?.label}
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Enabled</span>
                    <Switch
                      checked={methodStates[selectedMethod].isEnabled}
                      onCheckedChange={() => toggleMethod(selectedMethod)}
                      data-testid={`switch-${selectedMethod}`}
                    />
                  </div>
                </div>

                {/* Instructions - only for methods that need them */}
                {PAYMENT_METHODS.find(m => m.type === selectedMethod)?.hasInstructions && (
                  <div className="space-y-2">
                    <Label htmlFor={`${selectedMethod}-instructions`} className="text-sm">
                      Payment Instructions
                    </Label>
                    <Textarea
                      id={`${selectedMethod}-instructions`}
                      placeholder={getPlaceholder(selectedMethod)}
                      value={methodStates[selectedMethod].instructions}
                      onChange={(e) =>
                        updateMethodState(selectedMethod, {
                          instructions: e.target.value,
                        })
                      }
                      className="resize-none text-sm"
                      rows={2}
                      data-testid={`input-instructions-${selectedMethod}`}
                    />
                  </div>
                )}

                {/* Display Name - available for ALL methods */}
                <div className="space-y-2">
                  <Label htmlFor={`${selectedMethod}-label`} className="text-sm">
                    Display Name (optional)
                  </Label>
                  <Input
                    id={`${selectedMethod}-label`}
                    placeholder={`e.g., "My ${PAYMENT_METHODS.find(m => m.type === selectedMethod)?.label}"`}
                    value={methodStates[selectedMethod].customLabel}
                    onChange={(e) =>
                      updateMethodState(selectedMethod, {
                        customLabel: e.target.value,
                      })
                    }
                    className="h-9"
                    data-testid={`input-label-${selectedMethod}`}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={bulkUpdateMutation.isPending}
          className="w-full"
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
