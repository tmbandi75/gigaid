import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  TrendingUp,
  Calendar,
  Filter,
} from "lucide-react";
import { format } from "date-fns";
import type { Review } from "@shared/schema";

interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  distribution: { [key: number]: number };
}

export default function Reviews() {
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reviews</h1>
        <Badge variant="outline" className="text-sm">
          {stats.totalReviews} total
        </Badge>
      </div>

      <Card data-testid="card-review-stats">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="text-4xl font-bold">{stats.averageRating.toFixed(1)}</span>
                <Star className="h-8 w-8 fill-yellow-400 text-yellow-400" />
              </div>
              <p className="text-sm text-muted-foreground">Average rating</p>
            </div>
            <div className="h-16 border-l" />
            <div className="flex-1 pl-6 space-y-1">
              {[5, 4, 3, 2, 1].map((star) => (
                <div key={star} className="flex items-center gap-2 text-sm">
                  <span className="w-3">{star}</span>
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-yellow-400 rounded-full transition-all"
                      style={{ 
                        width: stats.totalReviews > 0 
                          ? `${((stats.distribution[star] || 0) / stats.totalReviews) * 100}%` 
                          : "0%" 
                      }}
                    />
                  </div>
                  <span className="w-6 text-muted-foreground">{stats.distribution[star] || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        {(["all", "pending", "responded"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
            data-testid={`button-filter-${f}`}
          >
            {f === "all" && <Filter className="h-4 w-4 mr-1" />}
            {f === "pending" && <MessageSquare className="h-4 w-4 mr-1" />}
            {f === "responded" && <ThumbsUp className="h-4 w-4 mr-1" />}
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {filteredReviews.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Star className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">No reviews yet</h3>
            <p className="text-sm text-muted-foreground">
              Reviews from your clients will appear here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredReviews.map((review) => (
            <Card key={review.id} data-testid={`card-review-${review.id}`}>
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <Avatar>
                    <AvatarFallback>{getInitials(review.clientName)}</AvatarFallback>
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
                          variant="outline"
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
                      <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="text-xs">Your Response</Badge>
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedReview} onOpenChange={(open) => !open && setSelectedReview(null)}>
        <DialogContent data-testid="dialog-respond">
          <DialogHeader>
            <DialogTitle>Respond to Review</DialogTitle>
          </DialogHeader>

          {selectedReview && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium">{selectedReview.clientName}</span>
                  {renderStars(selectedReview.rating)}
                </div>
                {selectedReview.comment && (
                  <p className="text-sm text-muted-foreground">{selectedReview.comment}</p>
                )}
              </div>

              <Textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Write your response..."
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
