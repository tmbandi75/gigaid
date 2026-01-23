import { useState, useCallback } from 'react';
import { Mic, Check, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useOfflineActions } from '@/hooks/useOffline';
import { useToast } from '@/hooks/use-toast';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useQuery } from '@tanstack/react-query';

interface DriveModeViewProps {
  onExit: () => void;
}

interface Job {
  id: number;
  title: string;
  status: string;
  scheduledDate?: string;
}

export function DriveModeView({ onExit }: DriveModeViewProps) {
  const { saveNote, updateStatus, saveVoiceNote, isOffline } = useOfflineActions();
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  const { data: todayJobs = [] } = useQuery<Job[]>({
    queryKey: ['/api/jobs/today'],
  });

  const activeJob = todayJobs.find(j => j.status === 'in_progress') || todayJobs[0];

  const startVoiceNote = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        if (activeJob) {
          await saveVoiceNote('job', String(activeJob.id), blob, Date.now());
          toast({
            description: isOffline ? 'Voice note saved — will sync when online' : 'Voice note saved',
          });
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch {
      toast({
        variant: 'destructive',
        description: 'Could not access microphone',
      });
    }
  }, [activeJob, saveVoiceNote, toast, isOffline]);

  const stopVoiceNote = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setIsRecording(false);
    }
  }, [mediaRecorder]);

  const handleMarkComplete = useCallback(async () => {
    if (!activeJob) return;
    
    await updateStatus('job', String(activeJob.id), 'completed');
    toast({
      description: isOffline ? 'Marked complete — will sync when online' : 'Job marked complete',
    });
  }, [activeJob, updateStatus, toast, isOffline]);

  const handleSaveNote = useCallback(async () => {
    if (!activeJob || !noteContent.trim()) return;
    
    await saveNote('job', String(activeJob.id), noteContent);
    toast({
      description: isOffline ? 'Note saved — will sync when online' : 'Note saved',
    });
    setNoteContent('');
    setShowNoteDialog(false);
  }, [activeJob, noteContent, saveNote, toast, isOffline]);

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col" data-testid="drive-mode-view">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h1 className="text-xl font-bold">Drive Mode</h1>
        <Button 
          variant="ghost" 
          size="icon"
          className="text-white"
          onClick={onExit}
          data-testid="button-exit-drive-mode"
        >
          <X className="h-6 w-6" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center p-6 gap-6">
        {activeJob ? (
          <Card className="w-full max-w-sm bg-zinc-900 border-zinc-700 p-4 text-center">
            <p className="text-zinc-400 text-sm mb-1">Current Job</p>
            <p className="text-xl font-semibold text-white">{activeJob.title}</p>
          </Card>
        ) : (
          <Card className="w-full max-w-sm bg-zinc-900 border-zinc-700 p-4 text-center">
            <p className="text-zinc-400">No active job</p>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4 w-full max-w-sm">
          <Button
            size="lg"
            variant={isRecording ? "destructive" : "secondary"}
            className="py-8 text-lg"
            onClick={isRecording ? stopVoiceNote : startVoiceNote}
            disabled={!activeJob}
            data-testid="button-drive-voice-note"
          >
            <Mic className="h-8 w-8 mr-3" />
            {isRecording ? 'Stop Recording' : 'Record voice note'}
          </Button>

          <Button
            size="lg"
            className="py-8 text-lg bg-green-700"
            onClick={handleMarkComplete}
            disabled={!activeJob}
            data-testid="button-drive-mark-complete"
          >
            <Check className="h-8 w-8 mr-3" />
            Mark job complete
          </Button>

          <Button
            size="lg"
            variant="secondary"
            className="py-8 text-lg"
            onClick={() => setShowNoteDialog(true)}
            disabled={!activeJob}
            data-testid="button-drive-add-note"
          >
            <FileText className="h-8 w-8 mr-3" />
            Add note
          </Button>
        </div>
      </div>

      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white">
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
          </DialogHeader>
          <Textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Enter your note..."
            className="min-h-[120px] bg-zinc-800 border-zinc-700 text-white"
            data-testid="input-drive-note"
          />
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 border-zinc-700 text-white"
              onClick={() => setShowNoteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSaveNote}
              disabled={!noteContent.trim()}
              data-testid="button-save-drive-note"
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
