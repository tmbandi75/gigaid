import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Share2, Loader2, Sparkles, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ReferralMessage {
  message: string;
  hashtags?: string[];
}

interface ReferralMessageAIProps {
  link: string;
  providerName?: string;
  serviceCategory?: string;
  defaultTone?: "friendly" | "professional" | "casual" | "enthusiastic";
}

export function ReferralMessageAI({
  link,
  providerName,
  serviceCategory,
  defaultTone = "friendly",
}: ReferralMessageAIProps) {
  const { toast } = useToast();
  const [tone, setTone] = useState<"friendly" | "professional" | "casual" | "enthusiastic">(defaultTone);
  const [message, setMessage] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai/referral-message", {
        tone,
        link,
        providerName,
        serviceCategory,
      });
      return response.json() as Promise<ReferralMessage>;
    },
    onSuccess: (data) => {
      setMessage(data.message);
      setHashtags(data.hashtags || []);
      toast({ title: "Referral message generated!" });
    },
    onError: () => {
      toast({ title: "Failed to generate message", variant: "destructive" });
    },
  });

  const handleCopy = async () => {
    const fullMessage = hashtags.length > 0 
      ? `${message}\n\n${hashtags.join(" ")}`
      : message;
    await navigator.clipboard.writeText(fullMessage);
    setCopied(true);
    toast({ title: "Copied to clipboard!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          text: message,
          url: link,
        });
      } catch (err) {
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Share2 className="h-4 w-4 text-primary" />
          Referral Message
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="refTone">Message Tone</Label>
          <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
            <SelectTrigger data-testid="select-referral-tone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="friendly">Friendly</SelectItem>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="casual">Casual</SelectItem>
              <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="w-full"
          data-testid="button-generate-referral"
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          Generate Referral Message
        </Button>

        {message && (
          <div className="space-y-3">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[100px]"
              data-testid="textarea-referral-message"
            />

            {hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {hashtags.map((tag, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleCopy}
                className="flex-1"
                data-testid="button-copy-referral"
              >
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? "Copied!" : "Copy"}
              </Button>
              <Button onClick={handleShare} className="flex-1" data-testid="button-share-referral">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
