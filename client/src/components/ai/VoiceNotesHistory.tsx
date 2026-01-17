import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  FileText, 
  Trash2, 
  Link as LinkIcon, 
  Clock,
  Loader2,
} from "lucide-react";
import type { VoiceNote, Job } from "@shared/schema";

interface VoiceNotesHistoryProps {
  onSelectNote?: (note: VoiceNote) => void;
}

export function VoiceNotesHistory({ onSelectNote }: VoiceNotesHistoryProps) {
  const { toast } = useToast();

  const { data: notes = [], isLoading } = useQuery<VoiceNote[]>({
    queryKey: ["/api/voice-notes"],
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/voice-notes/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-notes"] });
      toast({ title: "Voice note deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete note", variant: "destructive" });
    },
  });

  const typeLabels: Record<string, string> = {
    job: "Job Related",
    update: "Status Update",
    shareable: "Shareable",
    other: "General Note",
  };

  const typeColors: Record<string, string> = {
    job: "bg-blue-500/10 text-blue-600",
    update: "bg-orange-500/10 text-orange-600",
    shareable: "bg-green-500/10 text-green-600",
    other: "bg-gray-500/10 text-gray-600",
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "Recently";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "Recently";
      
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      } else if (diffDays === 1) {
        return "Yesterday";
      } else if (diffDays < 7) {
        return date.toLocaleDateString("en-US", { weekday: "short" });
      } else {
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      }
    } catch {
      return "Recently";
    }
  };

  const getJobTitle = (jobId: string | null) => {
    if (!jobId) return null;
    const job = jobs.find(j => j.id === jobId);
    return job ? `${job.title} - ${job.clientName}` : null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No saved voice notes yet</p>
        <p className="text-xs mt-1">Record a voice note and save it to see it here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Saved Notes</h3>
        <Badge variant="secondary" className="text-xs">
          {notes.length} note{notes.length !== 1 ? "s" : ""}
        </Badge>
      </div>
      
      <ScrollArea className="h-[300px]">
        <div className="space-y-2 pr-4">
          {notes.map((note, index) => (
            <div key={note.id}>
              {index > 0 && <Separator className="my-2" />}
              <Card 
                className="border-0 shadow-none bg-muted/30 hover-elevate cursor-pointer"
                onClick={() => onSelectNote?.(note)}
                data-testid={`voice-note-${note.id}`}
              >
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-clamp-2">{note.summary || "No summary"}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Badge className={typeColors[note.type || "other"]} variant="secondary">
                        {typeLabels[note.type || "other"]}
                      </Badge>
                    </div>
                  </div>
                  
                  {note.keyPoints && note.keyPoints.length > 0 && (
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {note.keyPoints.slice(0, 2).map((point, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <span className="text-muted-foreground">•</span>
                          <span className="line-clamp-1">{point}</span>
                        </li>
                      ))}
                      {note.keyPoints.length > 2 && (
                        <li className="text-muted-foreground/50">
                          +{note.keyPoints.length - 2} more
                        </li>
                      )}
                    </ul>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(note.createdAt)}
                      </span>
                      {note.jobId && (
                        <span className="flex items-center gap-1">
                          <LinkIcon className="h-3 w-3" />
                          {getJobTitle(note.jobId) || "Linked to job"}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(note.id);
                      }}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-note-${note.id}`}
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
