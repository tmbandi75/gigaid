import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Sparkles, Loader2, Check, Mic, MicOff, Edit } from "lucide-react";

interface JobDraft {
  service: string;
  date: string;
  time: string;
  clientName: string;
  clientPhone?: string;
  description?: string;
  duration?: number;
  price?: number;
}

interface TextToPlanInputProps {
  onJobCreated?: (job: JobDraft) => void;
  onSave?: (job: JobDraft) => void;
}

export function TextToPlanInput({ onJobCreated, onSave }: TextToPlanInputProps) {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [jobDraft, setJobDraft] = useState<JobDraft | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const parseMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest("POST", "/api/ai/text-to-plan", { message });
      return response as unknown as JobDraft;
    },
    onSuccess: (data) => {
      setJobDraft(data);
      toast({ title: "Job details extracted!" });
    },
    onError: () => {
      toast({ title: "Failed to parse job details", variant: "destructive" });
    },
  });

  const handleParse = () => {
    if (!input.trim()) {
      toast({ title: "Please enter a job description", variant: "destructive" });
      return;
    }
    parseMutation.mutate(input);
  };

  const handleSave = () => {
    if (jobDraft) {
      onSave?.(jobDraft);
      onJobCreated?.(jobDraft);
      setJobDraft(null);
      setInput("");
      toast({ title: "Job saved!" });
    }
  };

  const handleVoiceToggle = async () => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      toast({ title: "Voice input not supported in this browser", variant: "destructive" });
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    setIsRecording(true);
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev + " " + transcript);
      setIsRecording(false);
    };

    recognition.onerror = () => {
      setIsRecording(false);
      toast({ title: "Voice recognition error", variant: "destructive" });
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  const formatTime = (time: string) => {
    if (!time) return "";
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours);
    const ampm = h >= 12 ? "PM" : "AM";
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Quick Job Entry
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!jobDraft ? (
          <>
            <div className="relative">
              <Textarea
                placeholder="Describe the job in natural language, e.g., 'Fix leaky faucet for Mrs. Johnson tomorrow at 2pm'"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="min-h-[100px] pr-12"
                data-testid="input-text-to-plan"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2"
                onClick={handleVoiceToggle}
                data-testid="button-voice-input"
              >
                {isRecording ? (
                  <MicOff className="h-4 w-4 text-destructive" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
            </div>
            <Button
              onClick={handleParse}
              disabled={parseMutation.isPending || !input.trim()}
              className="w-full"
              data-testid="button-parse-job"
            >
              {parseMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Extract Job Details
            </Button>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Extracted Job Details</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                data-testid="button-edit-draft"
              >
                <Edit className="h-4 w-4 mr-1" />
                {isEditing ? "Done" : "Edit"}
              </Button>
            </div>

            <div className="grid gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Service</Label>
                {isEditing ? (
                  <Input
                    value={jobDraft.service}
                    onChange={(e) => setJobDraft({ ...jobDraft, service: e.target.value })}
                  />
                ) : (
                  <p className="text-sm font-medium capitalize">{jobDraft.service}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  {isEditing ? (
                    <Input
                      type="date"
                      value={jobDraft.date}
                      onChange={(e) => setJobDraft({ ...jobDraft, date: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm">{new Date(jobDraft.date).toLocaleDateString()}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Time</Label>
                  {isEditing ? (
                    <Input
                      type="time"
                      value={jobDraft.time}
                      onChange={(e) => setJobDraft({ ...jobDraft, time: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm">{formatTime(jobDraft.time)}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Client</Label>
                {isEditing ? (
                  <Input
                    value={jobDraft.clientName}
                    onChange={(e) => setJobDraft({ ...jobDraft, clientName: e.target.value })}
                  />
                ) : (
                  <p className="text-sm">{jobDraft.clientName || "Not specified"}</p>
                )}
              </div>

              {jobDraft.description && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <p className="text-sm">{jobDraft.description}</p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setJobDraft(null);
                  setInput("");
                }}
                className="flex-1"
                data-testid="button-cancel-draft"
              >
                Start Over
              </Button>
              <Button onClick={handleSave} className="flex-1" data-testid="button-save-job">
                <Check className="h-4 w-4 mr-2" />
                Save Job
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
