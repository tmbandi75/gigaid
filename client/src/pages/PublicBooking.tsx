import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Star, MapPin, Phone, Calendar, CheckCircle, Loader2 } from "lucide-react";

interface PublicProfile {
  name: string;
  photo: string | null;
  businessName: string | null;
  services: string[];
  bio: string | null;
  rating: number;
  reviewCount: number;
  reviews: Array<{
    id: string;
    clientName: string;
    rating: number;
    comment: string;
    createdAt: string;
  }>;
}

export default function PublicBooking() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    clientName: "",
    clientPhone: "",
    clientEmail: "",
    serviceType: "",
    preferredDate: "",
    preferredTime: "",
    location: "",
    description: "",
  });

  const { data: profile, isLoading, error } = useQuery<PublicProfile>({
    queryKey: ["/api/public/profile", slug],
    queryFn: async () => {
      const res = await fetch(`/api/public/profile/${slug}`);
      if (!res.ok) throw new Error("Profile not found");
      return res.json();
    },
    enabled: !!slug,
  });

  const submitMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      apiRequest("POST", `/api/public/book/${slug}`, data),
    onSuccess: () => {
      setSubmitted(true);
      toast({ title: "Booking request sent!" });
    },
    onError: () => {
      toast({ title: "Failed to submit booking", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientName || !formData.clientPhone || !formData.serviceType) {
      toast({ title: "Please fill in required fields", variant: "destructive" });
      return;
    }
    submitMutation.mutate(formData);
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
      />
    ));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold mb-2">Profile Not Found</h2>
            <p className="text-muted-foreground">
              This booking page doesn't exist or has been disabled.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Request Submitted!</h2>
            <p className="text-muted-foreground mb-4">
              {profile.name} will get back to you shortly to confirm your booking.
            </p>
            <Button variant="outline" onClick={() => setSubmitted(false)}>
              Submit Another Request
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="page-public-booking">
      <div className="max-w-2xl mx-auto p-4 py-8 space-y-6">
        <Card data-testid="card-provider-profile">
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16">
                {profile.photo ? (
                  <AvatarImage src={profile.photo} alt={profile.name} />
                ) : null}
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {getInitials(profile.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h1 className="text-xl font-bold">{profile.name}</h1>
                {profile.businessName && (
                  <p className="text-muted-foreground">{profile.businessName}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex">{renderStars(Math.round(profile.rating))}</div>
                  <span className="text-sm text-muted-foreground">
                    {profile.rating.toFixed(1)} ({profile.reviewCount} reviews)
                  </span>
                </div>
              </div>
            </div>

            {profile.bio && (
              <p className="text-sm text-muted-foreground mt-4">{profile.bio}</p>
            )}

            {profile.services.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {profile.services.map((service) => (
                  <Badge key={service} variant="secondary">
                    {service}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-booking-form">
          <CardHeader>
            <CardTitle>Request a Booking</CardTitle>
            <CardDescription>
              Fill out the form below and {profile.name.split(" ")[0]} will contact you to confirm.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientName">Your Name *</Label>
                  <Input
                    id="clientName"
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    placeholder="John Smith"
                    data-testid="input-client-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientPhone">Phone *</Label>
                  <Input
                    id="clientPhone"
                    value={formData.clientPhone}
                    onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                    placeholder="(555) 000-0000"
                    data-testid="input-client-phone"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientEmail">Email</Label>
                <Input
                  id="clientEmail"
                  type="email"
                  value={formData.clientEmail}
                  onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                  placeholder="john@example.com"
                  data-testid="input-client-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceType">Service Needed *</Label>
                <Select
                  value={formData.serviceType}
                  onValueChange={(v) => setFormData({ ...formData, serviceType: v })}
                >
                  <SelectTrigger data-testid="select-service-type">
                    <SelectValue placeholder="Select a service" />
                  </SelectTrigger>
                  <SelectContent>
                    {profile.services.length > 0 ? (
                      profile.services.map((service) => (
                        <SelectItem key={service} value={service}>
                          {service.charAt(0).toUpperCase() + service.slice(1)}
                        </SelectItem>
                      ))
                    ) : (
                      <>
                        <SelectItem value="plumbing">Plumbing</SelectItem>
                        <SelectItem value="electrical">Electrical</SelectItem>
                        <SelectItem value="cleaning">Cleaning</SelectItem>
                        <SelectItem value="handyman">Handyman</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="preferredDate">Preferred Date</Label>
                  <Input
                    id="preferredDate"
                    type="date"
                    value={formData.preferredDate}
                    onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
                    data-testid="input-preferred-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preferredTime">Preferred Time</Label>
                  <Input
                    id="preferredTime"
                    type="time"
                    value={formData.preferredTime}
                    onChange={(e) => setFormData({ ...formData, preferredTime: e.target.value })}
                    data-testid="input-preferred-time"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location / Address</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="123 Main St, City"
                  data-testid="input-location"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Describe the Job</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Please describe what you need help with..."
                  rows={4}
                  data-testid="input-description"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={submitMutation.isPending}
                data-testid="button-submit-booking"
              >
                {submitMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Calendar className="h-4 w-4 mr-2" />
                )}
                Request Booking
              </Button>
            </form>
          </CardContent>
        </Card>

        {profile.reviews.length > 0 && (
          <Card data-testid="card-reviews">
            <CardHeader>
              <CardTitle>Recent Reviews</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile.reviews.map((review) => (
                <div key={review.id} className="border-b last:border-0 pb-4 last:pb-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{review.clientName}</span>
                    <div className="flex">{renderStars(review.rating)}</div>
                  </div>
                  <p className="text-sm text-muted-foreground">{review.comment}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Powered by Gig Aid
        </p>
      </div>
    </div>
  );
}
