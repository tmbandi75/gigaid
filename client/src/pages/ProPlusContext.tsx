import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, AlertTriangle, DollarSign, CheckCircle } from "lucide-react";
import { Plan, PLAN_PRICES_DOLLARS } from "@shared/plans";

export default function ProPlusContext() {
  const [, navigate] = useLocation();
  
  const features = [
    { icon: Shield, label: "Automatic deposit enforcement" },
    { icon: AlertTriangle, label: "High-risk booking detection" },
    { icon: DollarSign, label: "Today's Money Plan (what gets you paid fastest)" },
  ];

  return (
    <div className="min-h-screen bg-background" data-testid="page-pro-plus-context">
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-600 via-amber-700 to-orange-800 text-white px-4 pt-6 pb-8">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -left-10 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl" />
        </div>
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.history.back()}
            className="mb-4 -ml-2 text-white/80 hover:text-white hover:bg-white/10"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Protect your jobs automatically</h1>
          <p className="text-amber-100/80 mt-1">See how Pro+ keeps your money safe</p>
        </div>
      </div>

      <div className="content-container -mt-4 relative z-10 pb-20">
        <Card className="border-0 shadow-lg mb-4">
          <CardContent className="p-6">
            <p className="text-muted-foreground">
              Pro+ helps prevent no-shows and late cancellations by enforcing deposits
              and flagging risky bookings before they cost you money.
            </p>

            <div className="mt-6 space-y-3">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <feature.icon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <span className="text-sm font-medium">{feature.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 mb-6">
          <CardContent className="p-6">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-amber-900 dark:text-amber-100">
                ${PLAN_PRICES_DOLLARS[Plan.PRO_PLUS].toFixed(2)}
              </span>
              <span className="text-muted-foreground">/ month</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Cancel anytime. No long-term commitment.
            </p>
          </CardContent>
        </Card>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => window.history.back()}
          data-testid="button-continue-without"
        >
          Continue without Pro+
        </Button>
      </div>
    </div>
  );
}
