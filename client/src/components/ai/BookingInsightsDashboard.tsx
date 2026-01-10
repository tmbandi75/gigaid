import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Calendar, Users, Clock, Lightbulb } from "lucide-react";

interface BookingInsights {
  topDays: Array<{ day: string; count: number }>;
  popularServices: Array<{ service: string; count: number; revenue: number }>;
  topClients: Array<{ name: string; jobs: number; totalSpent: number }>;
  busyHours: Array<{ hour: string; count: number }>;
  forecast: string;
  recommendations: string[];
}

export function BookingInsightsDashboard() {
  const { data: insights, isLoading, error } = useQuery<BookingInsights>({
    queryKey: ["/api/ai/booking-insights"],
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !insights) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <p>Unable to load insights</p>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  return (
    <div className="space-y-4" data-testid="booking-insights-dashboard">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Booking Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {insights.forecast && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
              <p className="text-sm font-medium flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4" />
                Forecast
              </p>
              <p className="text-sm text-muted-foreground" data-testid="text-forecast">{insights.forecast}</p>
            </div>
          )}

          {insights.topDays.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Busiest Days
              </p>
              <div className="flex flex-wrap gap-2">
                {insights.topDays.map((day, idx) => (
                  <Badge key={idx} variant="secondary" data-testid={`badge-day-${idx}`}>
                    {day.day}: {day.count} jobs
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {insights.busyHours.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Peak Hours
              </p>
              <div className="flex flex-wrap gap-2">
                {insights.busyHours.slice(0, 3).map((hour, idx) => (
                  <Badge key={idx} variant="outline" data-testid={`badge-hour-${idx}`}>
                    {hour.hour}: {hour.count} jobs
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {insights.popularServices.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Popular Services</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {insights.popularServices.slice(0, 5).map((service, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/50" data-testid={`row-service-${idx}`}>
                  <div>
                    <p className="text-sm font-medium capitalize" data-testid={`text-service-name-${idx}`}>{service.service}</p>
                    <p className="text-xs text-muted-foreground">{service.count} jobs</p>
                  </div>
                  <span className="text-sm font-medium text-primary" data-testid={`text-service-revenue-${idx}`}>
                    {formatCurrency(service.revenue)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {insights.topClients.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Top Clients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {insights.topClients.slice(0, 5).map((client, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/50" data-testid={`row-client-${idx}`}>
                  <div>
                    <p className="text-sm font-medium" data-testid={`text-client-name-${idx}`}>{client.name}</p>
                    <p className="text-xs text-muted-foreground">{client.jobs} jobs</p>
                  </div>
                  <span className="text-sm font-medium text-primary" data-testid={`text-client-spent-${idx}`}>
                    {formatCurrency(client.totalSpent)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {insights.recommendations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {insights.recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm" data-testid={`text-recommendation-${idx}`}>
                  <span className="text-primary font-bold">•</span>
                  {rec}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
