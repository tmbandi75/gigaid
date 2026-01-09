import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, DollarSign } from "lucide-react";

interface RevenueCardProps {
  totalEarnings: number;
  isLoading?: boolean;
}

export function RevenueCard({ totalEarnings, isLoading }: RevenueCardProps) {
  const formattedEarnings = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(totalEarnings / 100);

  if (isLoading) {
    return (
      <Card data-testid="card-revenue-loading">
        <CardHeader className="pb-2">
          <div className="h-5 w-24 bg-muted animate-pulse rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-10 w-32 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-primary text-primary-foreground" data-testid="card-revenue">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-primary-foreground/80">
          Total Earnings
        </CardTitle>
        <div className="h-8 w-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
          <DollarSign className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold" data-testid="text-total-earnings">
            {formattedEarnings}
          </span>
          <div className="flex items-center text-sm text-primary-foreground/80 mb-1">
            <TrendingUp className="h-4 w-4 mr-1" />
            <span>This period</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
