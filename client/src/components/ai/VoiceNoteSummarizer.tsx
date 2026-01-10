import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Mic, MicOff, Loader2, FileText, Copy, Check, Sparkles } from "lucide-react";

interface VoiceNoteSummary {
  transcript: string;
  summary: string;
  type: "job" | "update" | "shareable" | "other";
  keyPoints: string[];
}

interface VoiceNoteSummarizerProps {
  onSummaryComplete?: (summary: VoiceNoteSummary) => void;
}

export function VoiceNoteSummarizer({ onSummaryComplete }: VoiceNoteSummarizerProps) {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState<VoiceNoteSummary | null>(null);
  const [copied, setCopied] = useState(false);
  const recognitionRef = useRef<any>(null);

  const summarizeMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await apiRequest("POST", "/api/ai/summarize-voice-note", { transcript: text });
      return response as unknown as VoiceNoteSummary;
    },
    onSuccess: (data) => {
      setSummary(data);
      onSummaryComplete?.(data);
      toast({ title: "Voice note summarized!" });
    },
    onError: () => {
      toast({ title: "Failed to summarize", variant: "destructive" });
    },
  });

  const startRecording = () => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      toast({ title: "Voice input not supported", variant: "destructive" });
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;

    let finalTranscript = "";

    recognitionRef.current.onresult = (event: any) => {
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + " ";
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      setTranscript(finalTranscript + interimTranscript);
    };

    recognitionRef.current.onerror = () => {
      setIsRecording(false);
      toast({ title: "Recording error", variant: "destructive" });
    };

    recognitionRef.current.start();
    setIsRecording(true);
    toast({ title: "Recording started..." });
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
    if (transcript.trim()) {
      summarizeMutation.mutate(transcript);
    }
  };

  const handleCopy = async () => {
    if (summary) {
      await navigator.clipboard.writeText(summary.summary);
      setCopied(true);
      toast({ title: "Summary copied!" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const typeLabels = {
    job: "Job Related",
    update: "Status Update",
    shareable: "Shareable",
    other: "General Note",
  };

  const typeColors = {
    job: "bg-blue-500/10 text-blue-600",
    update: "bg-orange-500/10 text-orange-600",
    shareable: "bg-green-500/10 text-green-600",
    other: "bg-gray-500/10 text-gray-600",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Voice Note Summarizer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center gap-4">
          <Button
            size="lg"
            variant={isRecording ? "destructive" : "default"}
            className="h-16 w-16 rounded-full"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={summarizeMutation.isPending}
            data-testid="button-record-voice"
          >
            {summarizeMutation.isPending ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : isRecording ? (
              <MicOff className="h-6 w-6" />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </Button>
          <p className="text-sm text-muted-foreground">
            {isRecording ? "Tap to stop recording" : "Tap to start recording"}
          </p>
        </div>

        {transcript && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Transcript</p>
            <Textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="min-h-[80px] text-sm"
              data-testid="textarea-transcript"
            />
            {!summary && !summarizeMutation.isPending && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => summarizeMutation.mutate(transcript)}
                className="w-full"
                data-testid="button-summarize"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Summarize
              </Button>
            )}
          </div>
        )}

        {summary && (
          <div className="space-y-3 p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Summary</p>
              <Badge className={typeColors[summary.type]}>{typeLabels[summary.type]}</Badge>
            </div>
            <p className="text-sm">{summary.summary}</p>
            
            {summary.keyPoints.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Key Points</p>
                <ul className="text-sm space-y-1">
                  {summary.keyPoints.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button variant="outline" size="sm" onClick={handleCopy} data-testid="button-copy-summary">
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? "Copied!" : "Copy Summary"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
