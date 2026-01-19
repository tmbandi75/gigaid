import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SupportTicketForm } from "@/components/SupportTicketForm";
import { 
  Loader2, 
  DollarSign,
  Check,
  Clock,
  Eye,
  Phone,
  Mail,
  Building2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface PriceConfirmationData {
  id: string;
  serviceType: string | null;
  agreedPrice: number;
  notes: string | null;
  status: string;
  clientName: string;
  provider: {
    name: string | null;
    businessName: string | null;
    phone: string | null;
    email: string | null;
  };
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export default function ConfirmPrice() {
  const { token } = useParams<{ token: string }>();
  const [confirmed, setConfirmed] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<PriceConfirmationData>({
    queryKey: ["/api/public/price-confirmation", token],
    queryFn: async () => {
      const res = await fetch(`/api/public/price-confirmation/${token}`);
      if (!res.ok) {
        throw new Error("Price confirmation not found");
      }
      return res.json();
    },
    enabled: !!token,
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/public/price-confirmation/${token}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        throw new Error("Failed to confirm");
      }
      return res.json();
    },
    onSuccess: () => {
      setConfirmed(true);
      refetch();
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
        <div className="w-full max-w-md">
          <Card>
            <CardContent className="pt-6 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Not Found</h2>
              <p className="text-muted-foreground">
                This price confirmation link is invalid or has expired.
              </p>
            </CardContent>
          </Card>
          <SupportTicketForm context="Price confirmation not found" />
        </div>
      </div>
    );
  }

  const providerName = data.provider.businessName || data.provider.name || "Your Service Provider";
  const isAlreadyConfirmed = data.status === "confirmed" || confirmed;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 p-4" data-testid="page-confirm-price">
      <div className="max-w-md mx-auto space-y-4">
        <Card>
          <CardHeader className="text-center pb-2">
            <div className="flex items-center justify-center mb-2">
              {data.provider.businessName ? (
                <Building2 className="h-8 w-8 text-primary" />
              ) : (
                <DollarSign className="h-8 w-8 text-primary" />
              )}
            </div>
            <CardTitle className="text-xl">Price Confirmation</CardTitle>
            <CardDescription>
              From {providerName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Hi {data.clientName},</p>
              <p className="text-sm text-muted-foreground">
                Please confirm the following price for your service:
              </p>
            </div>

            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">
                {data.serviceType || "Service"}
              </p>
              <p className="text-3xl font-bold text-primary" data-testid="text-price">
                {formatCurrency(data.agreedPrice)}
              </p>
            </div>

            {data.notes && (
              <div className="rounded-lg border p-3">
                <p className="text-sm text-muted-foreground font-medium mb-1">Notes:</p>
                <p className="text-sm">{data.notes}</p>
              </div>
            )}

            <div className="flex items-center justify-center">
              <Badge 
                variant={isAlreadyConfirmed ? "default" : "secondary"}
                className="gap-1"
                data-testid="badge-status"
              >
                {isAlreadyConfirmed && <Check className="h-3 w-3" />}
                {data.status === "viewed" && !confirmed && <Eye className="h-3 w-3" />}
                {data.status === "sent" && <Clock className="h-3 w-3" />}
                {isAlreadyConfirmed ? "Confirmed" : data.status === "viewed" ? "Awaiting Confirmation" : "Sent"}
              </Badge>
            </div>

            {isAlreadyConfirmed ? (
              <div className="text-center space-y-3 pt-2">
                <div className="flex items-center justify-center text-green-600 dark:text-green-500">
                  <CheckCircle2 className="h-12 w-12" />
                </div>
                <div>
                  <p className="font-semibold text-lg">Price Confirmed!</p>
                  <p className="text-sm text-muted-foreground">
                    {providerName} will contact you to schedule your service.
                  </p>
                </div>
              </div>
            ) : (
              <Button
                className="w-full h-12"
                onClick={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending}
                data-testid="button-confirm"
              >
                {confirmMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Confirm Price
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.provider.phone && (
              <a 
                href={`tel:${data.provider.phone}`}
                className="flex items-center gap-2 text-sm hover-elevate p-2 rounded-md -mx-2"
                data-testid="link-phone"
              >
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{data.provider.phone}</span>
              </a>
            )}
            {data.provider.email && (
              <a 
                href={`mailto:${data.provider.email}`}
                className="flex items-center gap-2 text-sm hover-elevate p-2 rounded-md -mx-2"
                data-testid="link-email"
              >
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{data.provider.email}</span>
              </a>
            )}
            {!data.provider.phone && !data.provider.email && (
              <p className="text-sm text-muted-foreground">
                Contact your service provider directly for questions.
              </p>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground">
          Powered by GigAid
        </p>
      </div>
    </div>
  );
}
