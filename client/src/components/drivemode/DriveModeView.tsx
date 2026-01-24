import { useState, useCallback, useEffect } from 'react';
import { Mic, Check, FileText, X, ChevronLeft, ChevronRight, Car, MapPin, Clock, CircleCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOfflineActions } from '@/hooks/useOffline';
import { useToast } from '@/hooks/use-toast';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDriveModeContext } from './DriveModeProvider';
import { cn } from '@/lib/utils';

interface DriveModeViewProps {
  onExit: () => void;
}

interface Job {
  id: string;
  title: string;
  status: string;
  scheduledDate?: string;
  scheduledTime?: string;
  location?: string;
  clientName?: string;
}

type ActionFeedback = 'none' | 'recording' | 'success' | 'error';

export function DriveModeView({ onExit }: DriveModeViewProps) {
  const { saveNote, updateStatus, saveVoiceNote, isOffline } = useOfflineActions();
  const { toast } = useToast();
  const { currentSpeed, gpsStatus } = useDriveModeContext();
  const queryClient = useQueryClient();
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [currentJobIndex, setCurrentJobIndex] = useState(0);
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback>('none');
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);

  const { data: todayJobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ['/api/jobs/today'],
    refetchInterval: 30000,
  });

  const activeJob = todayJobs[currentJobIndex];
  const inProgressJobs = todayJobs.filter(j => j.status === 'in_progress' || j.status === 'scheduled');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration(d => d + 1);
      }, 1000);
    } else {
      setRecordingDuration(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const showFeedback = useCallback((type: 'success' | 'error') => {
    setActionFeedback(type);
    setTimeout(() => setActionFeedback('none'), 2000);
  }, []);

  const startVoiceNote = useCallback(async () => {
    if (!activeJob) return;
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
        
        await saveVoiceNote('job', String(activeJob.id), blob, recordingDuration * 1000);
        showFeedback('success');
        toast({
          description: isOffline ? 'Voice note saved - will sync when online' : 'Voice note saved',
        });
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setActionFeedback('recording');
    } catch {
      showFeedback('error');
      toast({
        variant: 'destructive',
        description: 'Could not access microphone',
      });
    }
  }, [activeJob, saveVoiceNote, toast, isOffline, recordingDuration, showFeedback]);

  const stopVoiceNote = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setIsRecording(false);
    }
  }, [mediaRecorder]);

  const handleMarkComplete = useCallback(async () => {
    if (!activeJob || isMarkingComplete) return;
    
    setIsMarkingComplete(true);
    try {
      await updateStatus('job', String(activeJob.id), 'completed');
      showFeedback('success');
      toast({
        description: isOffline ? 'Marked complete - will sync when online' : 'Job marked complete',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
    } catch {
      showFeedback('error');
    } finally {
      setIsMarkingComplete(false);
    }
  }, [activeJob, updateStatus, toast, isOffline, showFeedback, queryClient, isMarkingComplete]);

  const handleSaveNote = useCallback(async () => {
    if (!activeJob || !noteContent.trim()) return;
    
    try {
      await saveNote('job', String(activeJob.id), noteContent);
      showFeedback('success');
      toast({
        description: isOffline ? 'Note saved - will sync when online' : 'Note saved',
      });
      setNoteContent('');
      setShowNoteDialog(false);
    } catch {
      showFeedback('error');
    }
  }, [activeJob, noteContent, saveNote, toast, isOffline, showFeedback]);

  const prevJob = () => {
    if (currentJobIndex > 0) {
      setCurrentJobIndex(i => i - 1);
    }
  };

  const nextJob = () => {
    if (currentJobIndex < todayJobs.length - 1) {
      setCurrentJobIndex(i => i + 1);
    }
  };

  const formatSpeed = (speed: number | null) => {
    if (speed === null) return '--';
    const mph = Math.round(speed * 2.237);
    return mph;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      className={cn(
        "fixed inset-0 z-50 flex flex-col transition-colors duration-500",
        actionFeedback === 'success' && "bg-emerald-950",
        actionFeedback === 'error' && "bg-red-950",
        actionFeedback === 'recording' && "bg-rose-950",
        actionFeedback === 'none' && "bg-zinc-950"
      )} 
      data-testid="drive-mode-view"
    >
      <div className="flex items-center justify-between p-4 border-b border-zinc-800/50">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-3 h-3 rounded-full animate-pulse",
            gpsStatus === 'active' ? "bg-emerald-500" : 
            gpsStatus === 'requesting' ? "bg-amber-500" : "bg-zinc-600"
          )} />
          <div className="flex items-center gap-2 text-zinc-400">
            <Car className="h-5 w-5" />
            <span className="text-2xl font-bold text-white tabular-nums">
              {formatSpeed(currentSpeed)}
            </span>
            <span className="text-sm">mph</span>
          </div>
        </div>
        
        <h1 className="text-lg font-semibold text-white">Drive Mode</h1>
        
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onExit}
          data-testid="button-exit-drive-mode"
        >
          <X className="h-6 w-6" />
        </Button>
      </div>

      {isOffline && (
        <div className="bg-amber-900/50 px-4 py-2 text-center text-amber-200 text-sm" data-testid="status-offline-indicator">
          Offline - Actions will sync when connected
        </div>
      )}

      <div className="flex-1 flex flex-col p-6 gap-6 overflow-hidden">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-12 w-12 text-zinc-500 animate-spin" />
          </div>
        ) : todayJobs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
              <Clock className="h-10 w-10 text-zinc-500" />
            </div>
            <p className="text-xl text-zinc-400">No jobs scheduled for today</p>
            <p className="text-sm text-zinc-600 mt-2">Enjoy your day off</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "rounded-full",
                  currentJobIndex === 0 && "opacity-30 pointer-events-none"
                )}
                onClick={prevJob}
                disabled={currentJobIndex === 0}
                data-testid="button-prev-job"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              
              <div className="flex-1 mx-4 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800/50 border border-zinc-700/50" data-testid="text-job-counter">
                  <span className="text-zinc-400 text-sm">
                    {currentJobIndex + 1} of {todayJobs.length}
                  </span>
                  {inProgressJobs.length > 0 && (
                    <span className="text-emerald-400 text-sm" data-testid="text-active-jobs-count">
                      ({inProgressJobs.length} active)
                    </span>
                  )}
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "rounded-full",
                  currentJobIndex >= todayJobs.length - 1 && "opacity-30 pointer-events-none"
                )}
                onClick={nextJob}
                disabled={currentJobIndex >= todayJobs.length - 1}
                data-testid="button-next-job"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </div>

            {activeJob && (
              <div className="bg-zinc-900/80 rounded-2xl border border-zinc-800 p-6 space-y-4" data-testid="card-current-job">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-2xl font-bold text-white leading-tight" data-testid="text-job-title">
                      {activeJob.title}
                    </p>
                    {activeJob.clientName && (
                      <p className="text-lg text-zinc-400 mt-1" data-testid="text-client-name">{activeJob.clientName}</p>
                    )}
                  </div>
                  <div className={cn(
                    "px-3 py-1 rounded-full text-sm font-medium",
                    activeJob.status === 'completed' && "bg-emerald-900/50 text-emerald-300",
                    activeJob.status === 'in_progress' && "bg-blue-900/50 text-blue-300",
                    activeJob.status === 'scheduled' && "bg-zinc-800 text-zinc-300"
                  )} data-testid="status-job-badge">
                    {activeJob.status === 'completed' ? 'Done' : 
                     activeJob.status === 'in_progress' ? 'In Progress' : 'Scheduled'}
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-4 text-zinc-400">
                  {activeJob.scheduledTime && (
                    <div className="flex items-center gap-2" data-testid="text-scheduled-time">
                      <Clock className="h-5 w-5" />
                      <span className="text-lg">{activeJob.scheduledTime}</span>
                    </div>
                  )}
                  {activeJob.location && (
                    <div className="flex items-center gap-2" data-testid="text-job-location">
                      <MapPin className="h-5 w-5" />
                      <span className="text-lg truncate max-w-[200px]">{activeJob.location}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex-1 flex flex-col justify-center gap-4">
              <Button
                size="lg"
                variant={isRecording ? "destructive" : "secondary"}
                className={cn(
                  "w-full py-10 text-xl font-semibold rounded-2xl",
                  isRecording && "animate-pulse"
                )}
                onClick={isRecording ? stopVoiceNote : startVoiceNote}
                disabled={!activeJob || activeJob.status === 'completed'}
                data-testid="button-drive-voice-note"
              >
                <Mic className={cn("h-8 w-8 mr-4", isRecording && "animate-bounce")} />
                {isRecording ? (
                  <span>Stop Recording - {formatTime(recordingDuration)}</span>
                ) : (
                  <span>Record Voice Note</span>
                )}
              </Button>

              <Button
                size="lg"
                variant={activeJob?.status === 'completed' ? "outline" : "default"}
                className={cn(
                  "w-full py-10 text-xl font-semibold rounded-2xl",
                  activeJob?.status !== 'completed' && "bg-emerald-600"
                )}
                onClick={handleMarkComplete}
                disabled={!activeJob || activeJob.status === 'completed' || isMarkingComplete}
                data-testid="button-drive-mark-complete"
              >
                {isMarkingComplete ? (
                  <Loader2 className="h-8 w-8 mr-4 animate-spin" />
                ) : activeJob?.status === 'completed' ? (
                  <CircleCheck className="h-8 w-8 mr-4" />
                ) : (
                  <Check className="h-8 w-8 mr-4" />
                )}
                <span>
                  {activeJob?.status === 'completed' ? 'Completed' : 'Mark Complete'}
                </span>
              </Button>

              <Button
                size="lg"
                variant="secondary"
                className="w-full py-10 text-xl font-semibold rounded-2xl"
                onClick={() => setShowNoteDialog(true)}
                disabled={!activeJob || activeJob.status === 'completed'}
                data-testid="button-drive-add-note"
              >
                <FileText className="h-8 w-8 mr-4" />
                <span>Add Note</span>
              </Button>
            </div>
          </>
        )}
      </div>

      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">Add Note</DialogTitle>
          </DialogHeader>
          <Textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Enter your note..."
            className="min-h-[150px] text-lg bg-zinc-800 border-zinc-700 text-white focus:ring-emerald-500"
            data-testid="input-drive-note"
          />
          <div className="flex gap-3">
            <Button
              size="lg"
              variant="outline"
              className="flex-1 text-lg"
              onClick={() => setShowNoteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              size="lg"
              className="flex-1 text-lg bg-emerald-600"
              onClick={handleSaveNote}
              disabled={!noteContent.trim()}
              data-testid="button-save-drive-note"
            >
              Save Note
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {actionFeedback === 'success' && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-32 h-32 rounded-full bg-emerald-500/20 flex items-center justify-center animate-ping">
            <CircleCheck className="h-16 w-16 text-emerald-400" />
          </div>
        </div>
      )}
    </div>
  );
}
