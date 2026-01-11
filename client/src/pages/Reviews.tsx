import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Star, 
  MessageSquare, 
  ThumbsUp, 
  Send, 
  Loader2,
  ArrowLeft,
  TrendingUp,
  Award,
  MessageCircle,
} from "lucide-react";
import { format } from "date-fns";
import type { Review } from "@shared/schema";

interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  distribution: { [key: number]: number };
}

export default function Reviews() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [responseText, setResponseText] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "responded">("all");

  const { data: reviews = [], isLoading } = useQuery<Review[]>({
    queryKey: ["/api/reviews"],
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, response }: { id: string; response: string }) =>
      apiRequest("POST", `/api/reviews/${id}/respond`, { response }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
      setSelectedReview(null);
      setResponseText("");
      toast({ title: "Response sent" });
    },
    onError: () => {
      toast({ title: "Failed to send response", variant: "destructive" });
    },
  });

  const stats: ReviewStats = {
    averageRating: reviews.length > 0 
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
      : 0,
    totalReviews: reviews.length,
    distribution: reviews.reduce((acc, r) => {
      acc[r.rating] = (acc[r.rating] || 0) + 1;
      return acc;
    }, {} as { [key: number]: number }),
  };

  const filteredReviews = reviews.filter(review => {
    if (filter === "pending") return !review.providerResponse;
    if (filter === "responded") return !!review.providerResponse;
    return true;
  });

  const pendingCount = reviews.filter(r => !r.providerResponse).length;

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const renderStars = (rating: number, size: "sm" | "md" | "lg" = "sm") => {
    const sizeClass = size === "lg" ? "h-6 w-6" : size === "md" ? "h-5 w-5" : "h-4 w-4";
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizeClass} ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
          />
        ))}
      </div>
    );
  };

  const handleRespond = () => {
    if (!selectedReview || !responseText.trim()) return;
    respondMutation.mutate({ id: selectedReview.id, response: responseText.trim() });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-yellow-500 to-orange-500 text-white px-4 pt-6 pb-8">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          </div>
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/more")}
              className="mb-4 -ml-2 text-white/80 hover:text-white hover:bg-white/10"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">Reviews</h1>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24" data-testid="page-reviews">
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-yellow-500 to-orange-500 text-white px-4 pt-6 pb-12">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -left-10 w-32 h-32 bg-orange-400/20 rounded-full blur-2xl" />
        </div>
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/more")}
            className="mb-4 -ml-2 text-white/80 hover:text-white hover:bg-white/10"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Reviews</h1>
              <p className="text-amber-100/80 mt-1">See what clients say about you</p>
            </div>
            {pendingCount > 0 && (
              <Badge className="bg-white/20 text-white border-0">
                {pendingCount} awaiting response
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 -mt-6 relative z-10 space-y-4">
        <Card className="border-0 shadow-lg overflow-hidden" data-testid="card-review-stats">
          <CardContent className="p-0">
            <div className="flex">
              <div className="flex-1 p-6 flex flex-col items-center justify-center border-r border-border/50">
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-bold">{stats.averageRating.toFixed(1)}</span>
                  <Star className="h-6 w-6 fill-yellow-400 text-yellow-400 mb-1" />
                </div>
                <p className="text-sm text-muted-foreground">Average rating</p>
                <p className="text-xs text-muted-foreground mt-1">{stats.totalReviews} reviews</p>
              </div>
              <div className="flex-1 p-4 space-y-2">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = stats.distribution[star] || 0;
                  const percentage = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-2 text-sm">
                      <span className="w-3 text-muted-foreground">{star}</span>
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-yellow-400 to-amber-400 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="w-6 text-xs text-muted-foreground text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-2">
            <div className="flex gap-1">
              {[
                { key: "all" as const, label: "All", icon: Star },
                { key: "pending" as const, label: "Pending", icon: MessageCircle },
                { key: "responded" as const, label: "Responded", icon: ThumbsUp },
              ].map((f) => {
                const Icon = f.icon;
                const isActive = filter === f.key;
                return (
                  <Button
                    key={f.key}
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setFilter(f.key)}
                    className={`flex-1 gap-1.5 ${isActive ? "" : "text-muted-foreground"}`}
                    data-testid={`button-filter-${f.key}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {f.label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {filteredReviews.length === 0 ? (
          <Card className="border-0 shadow-md">
            <CardContent className="py-16 text-center">
              <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                <Star className="h-8 w-8 text-amber-500" />
              </div>
              <h3 className="font-semibold text-lg mb-2">No reviews yet</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Reviews from your clients will appear here after they rate your service
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredReviews.map((review) => (
              <Card key={review.id} className="border-0 shadow-md overflow-hidden" data-testid={`card-review-${review.id}`}>
                <CardContent className="p-0">
                  <div className="flex">
                    <div className={`w-1 ${review.providerResponse ? "bg-green-500" : "bg-amber-500"}`} />
                    <div className="flex-1 p-4">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-gradient-to-br from-amber-400 to-orange-500 text-white text-sm">
                            {getInitials(review.clientName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <p className="font-medium">{review.clientName}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {renderStars(review.rating)}
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(review.createdAt), "MMM d, yyyy")}
                                </span>
                              </div>
                            </div>
                            {!review.providerResponse && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedReview(review);
                                  setResponseText("");
                                }}
                                data-testid={`button-respond-${review.id}`}
                              >
                                <MessageSquare className="h-4 w-4 mr-1" />
                                Respond
                              </Button>
                            )}
                          </div>
                          
                          {review.comment && (
                            <p className="mt-3 text-sm">{review.comment}</p>
                          )}

                          {review.providerResponse && (
                            <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-100 dark:border-green-900/20">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                  <ThumbsUp className="h-3 w-3 mr-1" />
                                  Your Response
                                </Badge>
                                {review.respondedAt && (
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(review.respondedAt), "MMM d, yyyy")}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm">{review.providerResponse}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selectedReview} onOpenChange={(open) => !open && setSelectedReview(null)}>
        <DialogContent data-testid="dialog-respond">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-amber-600" />
              </div>
              <span>Respond to Review</span>
            </DialogTitle>
          </DialogHeader>

          {selectedReview && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-gradient-to-br from-amber-400 to-orange-500 text-white text-xs">
                      {getInitials(selectedReview.clientName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="font-medium text-sm">{selectedReview.clientName}</span>
                    <div className="flex items-center gap-1">
                      {renderStars(selectedReview.rating)}
                    </div>
                  </div>
                </div>
                {selectedReview.comment && (
                  <p className="text-sm text-muted-foreground">{selectedReview.comment}</p>
                )}
              </div>

              <Textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Thank the customer and address any feedback..."
                className="min-h-[100px]"
                data-testid="textarea-response"
              />

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedReview(null)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleRespond}
                  disabled={!responseText.trim() || respondMutation.isPending}
                  data-testid="button-send-response"
                >
                  {respondMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Send className="h-4 w-4 mr-1" />
                  )}
                  Send Response
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
