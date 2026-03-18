import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { useApiMutation } from "@/hooks/useApiMutation";
import { getSupportedAudioMimeType } from "@/lib/audioUtils";
import { getAuthToken } from "@/lib/authToken";
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
  CheckCircle,
  Volume2
} from "lucide-react";
import type { Job } from "@shared/schema";

/** Web Speech API (SpeechRecognition) is supported only in Chrome and some Chromium browsers. */
const hasSpeechRecognition = () =>
  typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

/** MediaRecorder is supported in Firefox, Safari, iOS, Android, and Chrome — use it as fallback for recording. */
const hasMediaRecorder = () => typeof window !== "undefined" && typeof MediaRecorder !== "undefined";

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
  /** When recording via MediaRecorder (Firefox/Safari/iOS), playback URL after server transcribes. */
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
    };
  }, [recordedAudioUrl]);

  const uploadAndTranscribe = useCallback(async (blob: Blob): Promise<string> => {
    const formData = new FormData();
    const ext = blob.type.includes("webm") ? "webm" : blob.type.includes("mp4") ? "mp4" : "ogg";
    formData.append("audio", blob, `recording.${ext}`);
    const token = getAuthToken();
    const res = await fetch("/api/ai/transcribe-voice-note", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
      body: formData,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Transcription failed");
    }
    const data = await res.json();
    return data.transcript ?? "";
  }, []);

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: QUERY_KEYS.jobs(),
  });

  const activeJobs = jobs.filter(j => j.status !== "completed" && j.status !== "cancelled");

  const summarizeMutation = useApiMutation(
    async (text: string) => {
      return apiFetch<VoiceNoteSummary>("/api/ai/summarize-voice-note", {
        method: "POST",
        body: JSON.stringify({ transcript: text }),
      });
    },
    [],
    {
      onSuccess: (data) => {
        setSummary(data);
        onSummaryComplete?.(data);
        toast({ title: "Voice note summarized!" });
      },
      onError: () => {
        toast({ title: "Failed to summarize", variant: "destructive" });
      },
    }
  );

  const saveMutation = useApiMutation(
    async (data: { transcript: string; summary: string; keyPoints: string[]; type: string; jobId?: string }) => {
      return apiFetch<{ id: string }>("/api/voice-notes", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    [QUERY_KEYS.voiceNotes()],
    {
      onSuccess: (data) => {
        setSavedNoteId(data.id);
        onNoteSaved?.(data.id);
        toast({ title: "Voice note saved!" });
      },
      onError: () => {
        toast({ title: "Failed to save note", variant: "destructive" });
      },
    }
  );

  const attachToJobMutation = useApiMutation(
    async ({ noteId, jobId }: { noteId: string; jobId: string }) => {
      return apiFetch(`/api/voice-notes/${noteId}`, {
        method: "PATCH",
        body: JSON.stringify({ jobId }),
      });
    },
    [QUERY_KEYS.voiceNotes(), QUERY_KEYS.jobs()],
    {
      onSuccess: () => {
        setShowJobSelector(false);
        toast({ title: "Note attached to job!" });
      },
      onError: () => {
        toast({ title: "Failed to attach note", variant: "destructive" });
      },
    }
  );

  const startRecording = useCallback(() => {
    if (hasSpeechRecognition()) {
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
      return;
    }

    if (hasMediaRecorder()) {
      setRecordedAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      chunksRef.current = [];
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          streamRef.current = stream;
          const mimeType = getSupportedAudioMimeType();
          const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
          mediaRecorderRef.current = recorder;
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
          };
          recorder.onstop = async () => {
            stream.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
            const blobType = recorder.mimeType || mimeType || "audio/webm";
            const blob = new Blob(chunksRef.current, { type: blobType });
            if (blob.size === 0) {
              toast({ title: "No audio recorded", variant: "destructive" });
              setIsRecording(false);
              return;
            }
            setRecordedAudioUrl(URL.createObjectURL(blob));
            setIsTranscribing(true);
            try {
              const text = await uploadAndTranscribe(blob);
              setTranscript(text);
              if (text.trim()) summarizeMutation.mutate(text);
              else toast({ title: "No speech detected", variant: "destructive" });
            } catch {
              toast({ title: "Transcription failed", variant: "destructive" });
            } finally {
              setIsTranscribing(false);
              setIsRecording(false);
            }
          };
          recorder.start();
          setIsRecording(true);
          toast({ title: "Recording started..." });
        })
        .catch(() => {
          toast({ title: "Could not access microphone", variant: "destructive" });
        });
      return;
    }

    toast({
      title: "Voice input not supported",
      description: "This browser does not support recording. Try Chrome, Firefox, Safari, or the iOS/Android app.",
      variant: "destructive",
    });
  }, [toast, uploadAndTranscribe, summarizeMutation]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsRecording(false);
      if (transcript.trim()) summarizeMutation.mutate(transcript);
      return;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  }, [transcript, summarizeMutation]);

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
      if (summary.serviceTitle) {
        params.set("title", summary.serviceTitle);
      }
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
    setRecordedAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
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
            disabled={summarizeMutation.isPending || isTranscribing}
            data-testid="button-record-voice"
          >
            {summarizeMutation.isPending || isTranscribing ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : isRecording ? (
              <MicOff className="h-6 w-6" />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </Button>
          <p className="text-sm text-muted-foreground">
            {isTranscribing
              ? "Transcribing..."
              : isRecording
                ? "Tap to stop recording"
                : "Tap to start recording"}
          </p>
        </div>

        {recordedAudioUrl && (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <p className="text-sm font-medium flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              Your recording
            </p>
            <audio controls src={recordedAudioUrl} className="w-full max-w-md" data-testid="audio-playback" />
          </div>
        )}

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
