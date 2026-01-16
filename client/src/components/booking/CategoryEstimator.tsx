import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { 
  DollarSign, 
  Loader2, 
  Sparkles, 
  Camera, 
  Ruler, 
  AlertCircle,
  Clock,
  Info
} from "lucide-react";
import {
  getEstimationProfile,
  shouldShowInstantEstimate,
  requiresProviderReview,
  hasNoPreBookEstimate,
  getAllowedMeasurements,
  supportsPhotoEstimation,
  AI_ESTIMATION_DISCLAIMER,
  type EstimationProfile,
} from "@shared/estimation-profiles";
import { findCategoryForService } from "@shared/service-categories";

interface AIEstimateResult {
  lowEstimate: number;
  highEstimate: number;
  confidence: "Low" | "Medium" | "High";
  basedOn: string[];
}

interface CategoryEstimatorProps {
  slug: string;
  serviceType: string;
  providerPublicEstimationEnabled: boolean;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  location?: string;
  onEstimationRequest?: (data: EstimationRequestData) => void;
}

interface EstimationRequestData {
  description: string;
  photos: string[];
  measurementArea?: number;
  measurementLinear?: number;
  measurementUnit?: string;
}

export function CategoryEstimator({ 
  slug, 
  serviceType,
  providerPublicEstimationEnabled,
  clientName,
  clientPhone,
  clientEmail,
  location,
  onEstimationRequest,
}: CategoryEstimatorProps) {
  const [description, setDescription] = useState("");
  const [measurementArea, setMeasurementArea] = useState("");
  const [measurementLinear, setMeasurementLinear] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [estimate, setEstimate] = useState<AIEstimateResult | null>(null);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [contactName, setContactName] = useState(clientName || "");
  const [contactPhone, setContactPhone] = useState(clientPhone || "");
  const [contactEmail, setContactEmail] = useState(clientEmail || "");

  const category = findCategoryForService(serviceType);
  const categoryId = category?.id || "other";
  const profile = getEstimationProfile(categoryId);
  
  const showInstantEstimate = shouldShowInstantEstimate(categoryId, providerPublicEstimationEnabled);
  const needsProviderReview = requiresProviderReview(categoryId);
  const noPreBookEstimate = hasNoPreBookEstimate(categoryId);
  const allowedMeasurements = getAllowedMeasurements(categoryId);
  const allowsPhotos = supportsPhotoEstimation(categoryId);

  const estimateMutation = useMutation({
    mutationFn: async (data: { 
      description: string; 
      measurementArea?: number;
      measurementLinear?: number;
    }) => {
      const res = await apiRequest("POST", "/api/public/ai/category-estimate", { 
        ...data,
        slug,
        categoryId,
        serviceType,
      });
      return res.json() as Promise<AIEstimateResult>;
    },
    onSuccess: (data) => {
      setEstimate(data);
    },
  });

  const estimationRequestMutation = useMutation({
    mutationFn: async (data: {
      clientName: string;
      clientPhone?: string;
      clientEmail?: string;
      description: string;
      photos?: string[];
      measurementArea?: number;
      measurementLinear?: number;
      location?: string;
    }) => {
      const res = await apiRequest("POST", "/api/public/estimation-request", {
        slug,
        categoryId,
        serviceType,
        ...data,
      });
      return res.json();
    },
    onSuccess: () => {
      setRequestSubmitted(true);
    },
  });

  const handleGetEstimate = () => {
    if (description.trim().length < 10) return;
    estimateMutation.mutate({
      description,
      measurementArea: measurementArea ? parseFloat(measurementArea) : undefined,
      measurementLinear: measurementLinear ? parseFloat(measurementLinear) : undefined,
    });
  };

  const handleSubmitRequest = () => {
    const requestData = {
      description,
      photos,
      measurementArea: measurementArea ? parseFloat(measurementArea) : undefined,
      measurementLinear: measurementLinear ? parseFloat(measurementLinear) : undefined,
      measurementUnit: "sqft",
    };

    if (onEstimationRequest) {
      onEstimationRequest(requestData);
      setRequestSubmitted(true);
    } else {
      estimationRequestMutation.mutate({
        clientName: contactName,
        clientPhone: contactPhone || undefined,
        clientEmail: contactEmail || undefined,
        description,
        photos: photos.length > 0 ? photos : undefined,
        measurementArea: measurementArea ? parseFloat(measurementArea) : undefined,
        measurementLinear: measurementLinear ? parseFloat(measurementLinear) : undefined,
        location,
      });
    }
  };

  if (!profile.enabled) {
    return null;
  }

  if (noPreBookEstimate) {
    return (
      <Card data-testid="category-estimator-no-prebook">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Pricing Available After Booking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              For this type of service, pricing is confirmed after an initial assessment. 
              Book a consultation or service call to get started.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (needsProviderReview && !showInstantEstimate) {
    if (requestSubmitted) {
      return (
        <Card data-testid="category-estimator-submitted">
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">Request Received</h3>
              <p className="text-sm text-muted-foreground">
                We'll review your request and confirm pricing shortly.
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card data-testid="category-estimator-review">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4" />
            Request a Price Quote
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              This service requires a custom quote. Provide details below and we'll 
              review your request and send you pricing.
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="contactName">Your Name</Label>
            <Input
              id="contactName"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Enter your name..."
              data-testid="input-contact-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactPhone">Phone or Email</Label>
            <Input
              id="contactPhone"
              value={contactPhone || contactEmail}
              onChange={(e) => {
                const val = e.target.value;
                if (val.includes("@")) {
                  setContactEmail(val);
                  setContactPhone("");
                } else {
                  setContactPhone(val);
                  setContactEmail("");
                }
              }}
              placeholder="How should we reach you?"
              data-testid="input-contact-phone"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Describe Your Job</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us what you need help with..."
              rows={3}
              data-testid="input-estimate-description"
            />
          </div>

          {allowsPhotos && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Add Photos (Optional)
              </Label>
              <p className="text-xs text-muted-foreground">
                Photos help us provide a more accurate estimate
              </p>
            </div>
          )}

          {allowedMeasurements.includes("area") && (
            <div className="space-y-2">
              <Label htmlFor="area" className="flex items-center gap-2">
                <Ruler className="h-4 w-4" />
                Approximate Area (sq ft)
              </Label>
              <Input
                id="area"
                type="number"
                value={measurementArea}
                onChange={(e) => setMeasurementArea(e.target.value)}
                placeholder="e.g., 1500"
                data-testid="input-measurement-area"
              />
            </div>
          )}

          {allowedMeasurements.includes("linear") && (
            <div className="space-y-2">
              <Label htmlFor="linear" className="flex items-center gap-2">
                <Ruler className="h-4 w-4" />
                Linear Feet (if applicable)
              </Label>
              <Input
                id="linear"
                type="number"
                value={measurementLinear}
                onChange={(e) => setMeasurementLinear(e.target.value)}
                placeholder="e.g., 100"
                data-testid="input-measurement-linear"
              />
            </div>
          )}

          <Button
            onClick={handleSubmitRequest}
            disabled={
              description.trim().length < 10 || 
              !contactName.trim() ||
              estimationRequestMutation.isPending
            }
            className="w-full"
            data-testid="button-request-estimate"
          >
            {estimationRequestMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Request Quote"
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (showInstantEstimate) {
    return (
      <Card data-testid="category-estimator-instant">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4" />
            Get a Price Estimate
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            <span>AI-powered estimate based on your job details</span>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Describe Your Job</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Deep clean a 3-bedroom house, including kitchen and 2 bathrooms..."
              rows={3}
              data-testid="input-estimate-description"
            />
          </div>

          {allowedMeasurements.includes("area") && (
            <div className="space-y-2">
              <Label htmlFor="area" className="flex items-center gap-2">
                <Ruler className="h-4 w-4" />
                Area (sq ft) - Optional
              </Label>
              <Input
                id="area"
                type="number"
                value={measurementArea}
                onChange={(e) => setMeasurementArea(e.target.value)}
                placeholder="e.g., 1500"
                data-testid="input-measurement-area"
              />
            </div>
          )}

          {allowedMeasurements.includes("linear") && (
            <div className="space-y-2">
              <Label htmlFor="linear" className="flex items-center gap-2">
                <Ruler className="h-4 w-4" />
                Linear Feet - Optional
              </Label>
              <Input
                id="linear"
                type="number"
                value={measurementLinear}
                onChange={(e) => setMeasurementLinear(e.target.value)}
                placeholder="e.g., 100"
                data-testid="input-measurement-linear"
              />
            </div>
          )}

          <Button
            onClick={handleGetEstimate}
            disabled={description.trim().length < 10 || estimateMutation.isPending}
            className="w-full"
            variant="outline"
            data-testid="button-get-estimate"
          >
            {estimateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <DollarSign className="h-4 w-4 mr-2" />
            )}
            Get Estimate
          </Button>

          {estimate && (
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20" data-testid="estimate-result">
              <div className="space-y-3">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Suggested Estimate</p>
                  <p className="text-2xl font-bold text-primary">
                    ${estimate.lowEstimate} – ${estimate.highEstimate}
                  </p>
                </div>
                
                <div className="flex items-center justify-center gap-2">
                  <span className="text-sm text-muted-foreground">Confidence:</span>
                  <span className={`text-sm font-medium ${
                    estimate.confidence === "High" ? "text-green-600" :
                    estimate.confidence === "Medium" ? "text-amber-600" :
                    "text-muted-foreground"
                  }`}>
                    {estimate.confidence}
                  </span>
                </div>

                {estimate.basedOn.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium mb-1">Based on:</p>
                    <ul className="space-y-0.5">
                      {estimate.basedOn.map((item, i) => (
                        <li key={i}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-xs text-muted-foreground text-center pt-2 border-t">
                  Final price confirmed onsite.
                </p>
              </div>
            </div>
          )}

          {(estimate || allowsPhotos) && (
            <p className="text-xs text-muted-foreground text-center">
              {AI_ESTIMATION_DISCLAIMER}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return null;
}
