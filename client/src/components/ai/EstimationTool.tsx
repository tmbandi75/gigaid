import { useState, useRef, type ChangeEvent } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { serviceCategories, type ServiceCategory } from "@shared/service-categories";
import { CATEGORY_ESTIMATION_PROFILES, type EstimationProfile } from "@shared/estimation-profiles";
import { 
  Calculator, 
  Loader2, 
  AlertTriangle,
  CheckCircle,
  Info,
  Camera,
  X,
  Image as ImageIcon,
} from "lucide-react";

interface EstimateResult {
  priceRange: { min: number; max: number };
  confidence: "low" | "medium" | "high";
  factors: string[];
  disclaimers: string[];
  aiGenerated: boolean;
  photosAnalyzed?: boolean;
}

interface EstimationToolProps {
  onEstimateComplete?: (estimate: EstimateResult) => void;
}

export function EstimationTool({ onEstimateComplete }: EstimationToolProps) {
  const [category, setCategory] = useState<string>("");
  const [description, setDescription] = useState("");
  const [squareFootage, setSquareFootage] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<EstimateResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const estimateMutation = useMutation({
    mutationFn: async (data: { category: string; description: string; squareFootage?: number; photos?: string[] }) => {
      const payloadSize = JSON.stringify(data).length;
      console.log(`[Estimation] Sending request, payload size: ${Math.round(payloadSize / 1024)}KB, photos: ${data.photos?.length || 0}`);
      
      if (payloadSize > 4 * 1024 * 1024) {
        console.warn("[Estimation] Payload too large, attempting without photos");
        const { photos, ...dataWithoutPhotos } = data;
        const response = await apiRequest("POST", "/api/estimation/in-app", dataWithoutPhotos);
        return response.json();
      }
      
      const response = await apiRequest("POST", "/api/estimation/in-app", data);
      return response.json();
    },
    onSuccess: (data) => {
      setResult(data);
      onEstimateComplete?.(data);
    },
    onError: (error) => {
      console.error("[Estimation] Error:", error);
    },
  });

  const selectedProfile: EstimationProfile | null = category ? CATEGORY_ESTIMATION_PROFILES[category] : null;

  const compressImage = (file: File, maxWidth: number = 600): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.5));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const maxFileSize = 5 * 1024 * 1024;
    const validFiles = Array.from(files).filter(f => 
      f.type.startsWith("image/") && f.size <= maxFileSize
    );

    if (validFiles.length === 0) return;

    setUploading(true);
    const newPhotos: string[] = [];

    for (const file of validFiles.slice(0, 4 - photos.length)) {
      try {
        const dataUrl = await compressImage(file);
        newPhotos.push(dataUrl);
      } catch {
        console.error("Failed to process image");
      }
    }

    setPhotos(prev => [...prev, ...newPhotos].slice(0, 4));
    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleEstimate = () => {
    if (!category || !description.trim()) return;
    
    estimateMutation.mutate({
      category,
      description,
      squareFootage: squareFootage ? parseInt(squareFootage) : undefined,
      photos: photos.length > 0 ? photos : undefined,
    });
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case "high":
        return <Badge className="bg-green-500/10 text-green-600 border-green-200">High Confidence</Badge>;
      case "medium":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-200">Medium Confidence</Badge>;
      default:
        return <Badge className="bg-orange-500/10 text-orange-600 border-orange-200">Low Confidence</Badge>;
    }
  };

  return (
    <div className="space-y-4" data-testid="estimation-tool">
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Service Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger data-testid="select-estimation-category">
              <SelectValue placeholder="Select a category..." />
            </SelectTrigger>
            <SelectContent>
              {serviceCategories.map((cat: ServiceCategory) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedProfile && (
          <Card className="bg-muted/50 border-0">
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium mb-1">Estimation Profile</p>
                  <p>
                    {selectedProfile.flow === "INSTANT_ESTIMATE" && "Instant estimates available for this category"}
                    {selectedProfile.flow === "PROVIDER_REVIEW_REQUIRED" && "This category requires your review before sending estimates"}
                    {selectedProfile.flow === "NO_PREBOOK_ESTIMATE" && "Complex category - on-site assessment recommended"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          <Label>Job Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the job details, scope, and any special requirements..."
            rows={4}
            data-testid="input-estimation-description"
          />
        </div>

        {selectedProfile?.measurement && selectedProfile.measurement.length > 0 && (
          <div className="space-y-2">
            <Label>Square Footage (optional)</Label>
            <Input
              type="number"
              value={squareFootage}
              onChange={(e) => setSquareFootage(e.target.value)}
              placeholder="Enter approximate square footage..."
              data-testid="input-estimation-sqft"
            />
          </div>
        )}

        {selectedProfile?.photo && (
          <div className="space-y-2">
            <Label>Photos (optional, up to 4)</Label>
            <div className="space-y-3">
              {photos.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {photos.map((photo, index) => (
                    <div key={index} className="relative group">
                      <img 
                        src={photo} 
                        alt={`Upload ${index + 1}`}
                        className="w-full h-16 object-cover rounded-md border"
                        data-testid={`img-photo-preview-${index}`}
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`button-remove-photo-${index}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {photos.length < 4 && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                    id="photo-upload"
                    data-testid="input-photo-upload"
                  />
                  <label htmlFor="photo-upload">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="cursor-pointer"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="button-upload-photos"
                    >
                      {uploading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="mr-2 h-4 w-4" />
                      )}
                      {photos.length === 0 ? "Add Photos" : "Add More"}
                    </Button>
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Photos help the AI assess job scope and complexity
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <Button
          onClick={handleEstimate}
          disabled={!category || !description.trim() || estimateMutation.isPending}
          className="w-full"
          data-testid="button-get-estimate"
        >
          {estimateMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Estimate...
            </>
          ) : (
            <>
              <Calculator className="mr-2 h-4 w-4" />
              Get AI Estimate
            </>
          )}
        </Button>
      </div>

      {estimateMutation.isError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">Failed to generate estimate. Please try again.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20" data-testid="card-estimation-result">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-semibold">Estimate Ready</span>
                {result.photosAnalyzed && (
                  <Badge variant="outline" className="text-xs">
                    <ImageIcon className="h-3 w-3 mr-1" />
                    Photos Analyzed
                  </Badge>
                )}
              </div>
              {getConfidenceBadge(result.confidence)}
            </div>

            <div className="text-center py-3">
              <p className="text-sm text-muted-foreground mb-1">Estimated Price Range</p>
              <p className="text-3xl font-bold text-green-600">
                {formatCurrency(result.priceRange.min)} - {formatCurrency(result.priceRange.max)}
              </p>
            </div>

            {result.factors.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Key Factors</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {result.factors.map((factor, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-green-600">•</span>
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.disclaimers.length > 0 && (
              <div className="text-xs text-muted-foreground border-t pt-3">
                {result.disclaimers.map((disclaimer, i) => (
                  <p key={i} className="flex items-start gap-1">
                    <span>*</span>
                    {disclaimer}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
