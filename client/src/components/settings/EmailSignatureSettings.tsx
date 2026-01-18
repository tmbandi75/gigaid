import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Mail, Loader2, ImageIcon, Save } from "lucide-react";

interface EmailSignature {
  emailSignatureText: string;
  emailSignatureLogoUrl: string;
  emailSignatureIncludeLogo: boolean;
}

export function EmailSignatureSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [signatureText, setSignatureText] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [includeLogo, setIncludeLogo] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: signature, isLoading } = useQuery<EmailSignature>({
    queryKey: ["/api/user/email-signature"],
  });

  useEffect(() => {
    if (signature) {
      setSignatureText(signature.emailSignatureText || "");
      setLogoUrl(signature.emailSignatureLogoUrl || "");
      setIncludeLogo(signature.emailSignatureIncludeLogo ?? true);
    }
  }, [signature]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<EmailSignature>) => {
      return apiRequest("PUT", "/api/user/email-signature", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/email-signature"] });
      toast({ title: "Email signature saved" });
      setHasChanges(false);
    },
    onError: () => {
      toast({ title: "Failed to save email signature", variant: "destructive" });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      emailSignatureText: signatureText,
      emailSignatureLogoUrl: logoUrl,
      emailSignatureIncludeLogo: includeLogo,
    });
  };

  const handleChange = (field: string, value: any) => {
    setHasChanges(true);
    switch (field) {
      case "text":
        setSignatureText(value);
        break;
      case "logo":
        setLogoUrl(value);
        break;
      case "includeLogo":
        setIncludeLogo(value);
        break;
    }
  };

  if (isLoading) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="p-4 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-md" data-testid="card-email-signature">
      <CardContent className="p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <Mail className="h-4 w-4 text-white" />
          </div>
          Email Signature
        </h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="signature-text">Signature Text</Label>
            <Textarea
              id="signature-text"
              placeholder="Enter your email signature (e.g., your name, phone, tagline)..."
              value={signatureText}
              onChange={(e) => handleChange("text", e.target.value)}
              rows={4}
              data-testid="input-signature-text"
            />
            <p className="text-xs text-muted-foreground">
              This will appear at the end of emails you send to leads.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo-url">Logo URL</Label>
            <Input
              id="logo-url"
              placeholder="https://example.com/your-logo.png"
              value={logoUrl}
              onChange={(e) => handleChange("logo", e.target.value)}
              data-testid="input-logo-url"
            />
            <p className="text-xs text-muted-foreground">
              Enter a URL to your business logo image.
            </p>
          </div>

          {logoUrl && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Logo Preview</p>
                <img 
                  src={logoUrl} 
                  alt="Logo preview" 
                  className="h-12 mt-2 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Include Logo in Emails</p>
              <p className="text-xs text-muted-foreground">Show your logo in email signatures</p>
            </div>
            <Switch
              checked={includeLogo}
              onCheckedChange={(checked) => handleChange("includeLogo", checked)}
              data-testid="switch-include-logo"
            />
          </div>

          <Button 
            onClick={handleSave}
            disabled={updateMutation.isPending || !hasChanges}
            className="w-full"
            data-testid="button-save-signature"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Signature
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
