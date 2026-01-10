import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { Sparkles, Loader2, RotateCcw } from "lucide-react";

interface BioEditorProps {
  value: string;
  onChange: (value: string) => void;
  businessName?: string;
  services?: string[];
}

export function BioEditor({ value, onChange, businessName, services }: BioEditorProps) {
  const [isTyping, setIsTyping] = useState(false);
  const [originalBio, setOriginalBio] = useState<string | null>(null);

  const rewriteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/rewrite-bio", {
        bio: value,
        businessName,
        services,
      });
      return res.json() as Promise<{ rewrittenBio: string }>;
    },
    onSuccess: (data) => {
      if (!originalBio) {
        setOriginalBio(value);
      }
      onChange(data.rewrittenBio);
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setIsTyping(newValue.length > 0);
  };

  const handleRestore = () => {
    if (originalBio) {
      onChange(originalBio);
      setOriginalBio(null);
    }
  };

  return (
    <div className="space-y-2" data-testid="bio-editor">
      <div className="flex items-center justify-between">
        <Label htmlFor="bio">Bio</Label>
        {isTyping && (
          <Badge variant="secondary" className="gap-1 text-xs">
            <Sparkles className="h-3 w-3" />
            AI Available
          </Badge>
        )}
      </div>
      
      <Textarea
        id="bio"
        value={value}
        onChange={handleChange}
        placeholder="Tell clients about yourself and your services..."
        rows={4}
        data-testid="input-bio"
      />

      {isTyping && value.length >= 20 && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => rewriteMutation.mutate()}
            disabled={rewriteMutation.isPending}
            data-testid="button-rewrite-bio"
          >
            {rewriteMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1" />
            )}
            Improve with AI
          </Button>
          
          {originalBio && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRestore}
              data-testid="button-restore-bio"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Restore Original
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
