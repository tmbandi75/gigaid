import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Mic, 
  MicOff, 
  Loader2, 
  FileText, 
  Copy, 
  Check, 
  Sparkles, 
  Save,
  Plus,
  Link as LinkIcon,
  CheckCircle
} from "lucide-react";
import type { Job } from "@shared/schema";

interface VoiceNoteSummary {
  transcript: string;
  summary: string;
  serviceTitle: string;
  clientName?: string;
  type: "job" | "update" | "shareable" | "other";
  keyPoints: string[];
}

interface VoiceNoteSummarizerProps {
  onSummaryComplete?: (summary: VoiceNoteSummary) => void;
  onNoteSaved?: (noteId: string) => void;
}

export function VoiceNoteSummarizer({ onSummaryComplete, onNoteSaved }: VoiceNoteSummarizerProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState<VoiceNoteSummary | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const [showJobSelector, setShowJobSelector] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const recognitionRef = useRef<any>(null);

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const activeJobs = jobs.filter(j => j.status !== "completed" && j.status !== "cancelled");

  const summarizeMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await apiRequest("POST", "/api/ai/summarize-voice-note", { transcript: text });
      return response.json() as Promise<VoiceNoteSummary>;
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

  const saveMutation = useMutation({
    mutationFn: async (data: { transcript: string; summary: string; keyPoints: string[]; type: string; jobId?: string }) => {
      const response = await apiRequest("POST", "/api/voice-notes", data);
      return response.json();
    },
    onSuccess: (data) => {
      setSavedNoteId(data.id);
      onNoteSaved?.(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/voice-notes"] });
      toast({ title: "Voice note saved!" });
    },
    onError: () => {
      toast({ title: "Failed to save note", variant: "destructive" });
    },
  });

  const attachToJobMutation = useMutation({
    mutationFn: async ({ noteId, jobId }: { noteId: string; jobId: string }) => {
      const response = await apiRequest("PATCH", `/api/voice-notes/${noteId}`, { jobId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setShowJobSelector(false);
      toast({ title: "Note attached to job!" });
    },
    onError: () => {
      toast({ title: "Failed to attach note", variant: "destructive" });
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

  const handleSave = () => {
    if (summary && transcript) {
      saveMutation.mutate({
        transcript: transcript,
        summary: summary.summary,
        keyPoints: summary.keyPoints || [],
        type: summary.type || "other",
      });
    }
  };

  const handleCreateJob = () => {
    if (summary) {
      const params = new URLSearchParams();
      // Use serviceTitle as the job title if available
      if (summary.serviceTitle) {
        params.set("title", summary.serviceTitle);
      }
      // Use clientName if extracted from the voice note
      if (summary.clientName) {
        params.set("clientName", summary.clientName);
      }
      params.set("description", summary.summary);
      if (summary.keyPoints.length > 0) {
        params.set("notes", summary.keyPoints.join("\n"));
      }
      navigate(`/jobs/new?${params.toString()}`);
    }
  };

  const handleAttachToJob = () => {
    if (savedNoteId && selectedJobId) {
      attachToJobMutation.mutate({ noteId: savedNoteId, jobId: selectedJobId });
    }
  };

  const handleNewRecording = () => {
    setTranscript("");
    setSummary(null);
    setSavedNoteId(null);
    setShowJobSelector(false);
    setSelectedJobId("");
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
            className="rounded-full"
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
          <div className="space-y-3 p-3 rounded-md bg-muted/50">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="space-y-1">
                {summary.serviceTitle && (
                  <p className="text-sm font-semibold">{summary.serviceTitle}</p>
                )}
                {summary.clientName && (
                  <p className="text-xs text-muted-foreground">Client: {summary.clientName}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {savedNoteId && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Saved
                  </Badge>
                )}
                <Badge className={typeColors[summary.type]}>{typeLabels[summary.type]}</Badge>
              </div>
            </div>
            <p className="text-sm">{summary.summary}</p>
            
            {summary.keyPoints && summary.keyPoints.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Key Points</p>
                <ul className="text-sm space-y-1">
                  {summary.keyPoints.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-muted-foreground">•</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={handleCopy} data-testid="button-copy-summary">
                {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              
              {!savedNoteId && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  data-testid="button-save-note"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Save
                </Button>
              )}

              <Button 
                variant="default" 
                size="sm" 
                onClick={handleCreateJob}
                data-testid="button-create-job-from-note"
              >
                <Plus className="h-4 w-4 mr-1" />
                Create Job
              </Button>

              {savedNoteId && !showJobSelector && activeJobs.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowJobSelector(true)}
                  data-testid="button-attach-to-job"
                >
                  <LinkIcon className="h-4 w-4 mr-1" />
                  Attach to Job
                </Button>
              )}
            </div>

            {showJobSelector && activeJobs.length > 0 && (
              <div className="flex gap-2 pt-2">
                <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                  <SelectTrigger className="flex-1" data-testid="select-job">
                    <SelectValue placeholder="Select a job..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeJobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.title} - {job.clientName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleAttachToJob}
                  disabled={!selectedJobId || attachToJobMutation.isPending}
                  data-testid="button-confirm-attach"
                >
                  {attachToJobMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}

            {savedNoteId && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleNewRecording}
                className="w-full mt-2"
                data-testid="button-new-recording"
              >
                <Mic className="h-4 w-4 mr-1" />
                New Recording
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
