import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, X, Loader2, ImagePlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PhotoUploadProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  maxPhotos: number;
  label?: string;
  helpText?: string;
  disabled?: boolean;
  className?: string;
}

export function PhotoUpload({
  photos,
  onPhotosChange,
  maxPhotos,
  label = "Add photos (optional)",
  helpText,
  disabled = false,
  className = "",
}: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = maxPhotos - photos.length;
    if (remainingSlots <= 0) {
      toast({
        title: `Maximum ${maxPhotos} photos allowed`,
        variant: "destructive",
      });
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    const validFiles: File[] = [];

    for (const file of filesToUpload) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Only JPEG, PNG, and WebP images are allowed",
          variant: "destructive",
        });
        continue;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Each image must be less than 5MB",
          variant: "destructive",
        });
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    setUploading(true);
    const newPhotoUrls: string[] = [];

    try {
      for (const file of validFiles) {
        const requestResponse = await fetch("/api/uploads/request-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            size: file.size,
            contentType: file.type,
          }),
          credentials: "include",
        });

        if (!requestResponse.ok) {
          throw new Error("Failed to get upload URL");
        }

        const { uploadURL, objectPath } = await requestResponse.json();

        const uploadResponse = await fetch(uploadURL, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error("Upload failed");
        }

        newPhotoUrls.push(objectPath);
      }

      onPhotosChange([...photos, ...newPhotoUrls]);
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Some photos could not be uploaded. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [photos, maxPhotos, onPhotosChange, toast]);

  const handleRemovePhoto = useCallback((index: number) => {
    const newPhotos = [...photos];
    newPhotos.splice(index, 1);
    onPhotosChange(newPhotos);
  }, [photos, onPhotosChange]);

  const canAddMore = photos.length < maxPhotos && !disabled;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <span className="text-xs text-muted-foreground">
          {photos.length}/{maxPhotos}
        </span>
      </div>

      {helpText && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((url, index) => (
            <div key={index} className="relative aspect-square group">
              <img
                src={url}
                alt={`Photo ${index + 1}`}
                className="w-full h-full object-cover rounded-lg border"
                data-testid={`img-photo-preview-${index}`}
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemovePhoto(index)}
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                  data-testid={`button-remove-photo-${index}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canAddMore && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            data-testid="input-photo-file"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full"
            data-testid="button-add-photos"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <ImagePlus className="h-4 w-4 mr-2" />
                Add Photos
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
