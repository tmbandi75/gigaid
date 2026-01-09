import { Mic, Send, X, Loader2, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

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

export function VoiceFAB() {
  const [, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [jobDraft, setJobDraft] = useState<JobDraft | null>(null);

  const parseMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest("POST", "/api/ai/text-to-plan", { message });
      return response.json() as Promise<JobDraft>;
    },
    onSuccess: (data) => {
      setJobDraft(data);
    },
  });

  const handleOpen = () => {
    setIsOpen(true);
    setInputText("");
    setJobDraft(null);
  };

  const handleClose = () => {
    setIsOpen(false);
    setInputText("");
    setJobDraft(null);
  };

  const handleSubmit = () => {
    if (inputText.trim()) {
      parseMutation.mutate(inputText.trim());
    }
  };

  const handleCreateJob = () => {
    if (jobDraft) {
      const params = new URLSearchParams();
      if (jobDraft.service) params.set("serviceType", jobDraft.service);
      if (jobDraft.date) params.set("date", jobDraft.date);
      if (jobDraft.time) params.set("time", jobDraft.time);
      if (jobDraft.clientName) params.set("clientName", jobDraft.clientName);
      if (jobDraft.clientPhone) params.set("clientPhone", jobDraft.clientPhone);
      if (jobDraft.description) params.set("description", jobDraft.description);
      if (jobDraft.duration) params.set("duration", String(jobDraft.duration));
      if (jobDraft.price) params.set("price", String(jobDraft.price));
      
      navigate(`/jobs/new?${params.toString()}`);
      handleClose();
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric"
      });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr: string) => {
    try {
      const [hours, minutes] = timeStr.split(":");
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? "PM" : "AM";
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes} ${ampm}`;
    } catch {
      return timeStr;
    }
  };

  return (
    <>
      <Button
        size="icon"
        className="fixed bottom-24 right-4 z-40 h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90"
        onClick={handleOpen}
        data-testid="button-voice-fab"
      >
        <Sparkles className="h-6 w-6 text-primary-foreground" />
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" data-testid="modal-text-to-plan">
          <div className="fixed inset-x-0 bottom-0 z-50 bg-background border-t rounded-t-xl shadow-lg animate-in slide-in-from-bottom duration-300">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">Quick Add Job</h2>
                </div>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={handleClose}
                  data-testid="button-close-modal"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <p className="text-sm text-muted-foreground mb-4">
                Describe the job in your own words and AI will structure it for you.
              </p>

              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="e.g., Fix leaky faucet for John Smith tomorrow at 2pm"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  disabled={parseMutation.isPending}
                  data-testid="input-text-to-plan"
                />
                <Button 
                  onClick={handleSubmit} 
                  disabled={!inputText.trim() || parseMutation.isPending}
                  data-testid="button-parse"
                >
                  {parseMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {parseMutation.isError && (
                <p className="text-sm text-destructive mb-4">
                  Failed to parse your message. Please try again.
                </p>
              )}

              {jobDraft && (
                <Card className="mb-4" data-testid="card-job-preview">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      Job Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{jobDraft.service || "Service"}</Badge>
                      <Badge variant="outline">{formatDate(jobDraft.date)}</Badge>
                      <Badge variant="outline">{formatTime(jobDraft.time)}</Badge>
                    </div>
                    {jobDraft.clientName && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Client:</span> {jobDraft.clientName}
                      </p>
                    )}
                    {jobDraft.description && (
                      <p className="text-sm text-muted-foreground">{jobDraft.description}</p>
                    )}
                    <Button 
                      className="w-full mt-2" 
                      onClick={handleCreateJob}
                      data-testid="button-create-job"
                    >
                      Create Job
                    </Button>
                  </CardContent>
                </Card>
              )}

              <div className="flex items-center justify-center py-2 border-t">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-muted-foreground"
                  onClick={() => {
                    handleClose();
                    navigate("/jobs/new");
                  }}
                  data-testid="button-manual-entry"
                >
                  Or create job manually
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
