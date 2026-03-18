import { useState, useCallback, useEffect } from 'react';
import { Mic, Check, FileText, X, ChevronLeft, ChevronRight, Navigation, MapPin, Clock, Loader2, Gauge, CheckCircle2, Volume2 } from 'lucide-react';
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
import { getSupportedAudioMimeType } from '@/lib/audioUtils';
import { motion, AnimatePresence } from 'framer-motion';

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
      const mimeType = getSupportedAudioMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const blobType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunks, { type: blobType });
        stream.getTracks().forEach(track => track.stop());

        await saveVoiceNote("job", String(activeJob.id), blob, recordingDuration * 1000);
        showFeedback("success");
        toast({
          description: isOffline ? "Voice note saved - will sync when online" : "Voice note saved",
        });
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setActionFeedback("recording");
    } catch {
      showFeedback("error");
      toast({
        variant: "destructive",
        description: "Could not access microphone",
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
    if (speed === null) return '0';
    const mph = Math.round(speed * 2.237);
    return mph.toString();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isJobComplete = activeJob?.status === 'completed';
  const isJobDisabled = !activeJob || isJobComplete;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      data-testid="drive-mode-view"
    >
      {/* Dynamic background with gradient mesh */}
      <div 
        className={cn(
          "absolute inset-0 transition-all duration-700",
          actionFeedback === 'success' && "bg-gradient-to-br from-emerald-950 via-emerald-900/80 to-black",
          actionFeedback === 'error' && "bg-gradient-to-br from-red-950 via-red-900/80 to-black",
          actionFeedback === 'recording' && "bg-gradient-to-br from-rose-950 via-rose-900/80 to-black",
          actionFeedback === 'none' && "bg-gradient-to-br from-slate-950 via-slate-900 to-black"
        )}
      />
      
      {/* Animated gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ 
            x: [0, 30, 0], 
            y: [0, -20, 0],
            scale: [1, 1.1, 1]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-20 -right-20 w-80 h-80 bg-primary/10 rounded-full blur-3xl"
        />
        <motion.div 
          animate={{ 
            x: [0, -20, 0], 
            y: [0, 30, 0],
            scale: [1, 1.2, 1]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-40 -left-20 w-60 h-60 bg-violet-500/10 rounded-full blur-3xl"
        />
        {isRecording && (
          <motion.div 
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-500/20 rounded-full blur-3xl"
          />
        )}
      </div>

      {/* Header with glass effect */}
      <header className="relative z-10 flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-4">
          {/* Speed gauge */}
          <div className="relative flex items-center justify-center">
            <div className={cn(
              "absolute inset-0 rounded-full blur-md transition-colors",
              gpsStatus === 'active' ? "bg-emerald-500/30" : "bg-slate-500/20"
            )} />
            <div className="relative flex flex-col items-center justify-center w-16 h-16 rounded-full bg-white/5 backdrop-blur-xl border border-white/10">
              <span className="text-2xl font-bold text-white tabular-nums leading-none">
                {formatSpeed(currentSpeed)}
              </span>
              <span className="text-[10px] text-white/50 uppercase tracking-wider">mph</span>
            </div>
          </div>
          
          {/* GPS Status */}
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              gpsStatus === 'active' && "bg-emerald-400 shadow-lg shadow-emerald-400/50",
              gpsStatus === 'requesting' && "bg-amber-400 animate-pulse",
              gpsStatus === 'inactive' && "bg-slate-500"
            )} />
            <span className="text-xs text-white/40">
              {gpsStatus === 'active' ? 'GPS Active' : gpsStatus === 'requesting' ? 'Connecting...' : 'GPS Off'}
            </span>
          </div>
        </div>

        <Button 
          variant="ghost" 
          size="icon"
          className="h-11 w-11 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 text-white"
          onClick={onExit}
          data-testid="button-exit-drive-mode"
          aria-label="Exit drive mode"
        >
          <X className="h-5 w-5" />
        </Button>
      </header>

      {/* Offline indicator */}
      <AnimatePresence>
        {isOffline && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative z-10 mx-5 px-4 py-2.5 rounded-xl bg-amber-500/10 backdrop-blur-xl border border-amber-500/20 flex items-center justify-center gap-2"
            data-testid="status-offline-indicator"
          >
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-sm text-amber-200/80">Offline mode - Actions will sync automatically</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col px-5 py-6 overflow-hidden">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="h-12 w-12 text-white/30" />
            </motion.div>
          </div>
        ) : todayJobs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative mb-6"
            >
              <div className="absolute inset-0 rounded-full bg-white/5 blur-xl scale-150" />
              <div className="relative w-24 h-24 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center">
                <Navigation className="h-10 w-10 text-white/30" />
              </div>
            </motion.div>
            <h2 className="text-2xl font-semibold text-white/90 mb-2">No Jobs Today</h2>
            <p className="text-white/40">Your schedule is clear. Enjoy your drive!</p>
          </div>
        ) : (
          <>
            {/* Job navigation */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-10 w-10 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 text-white",
                  currentJobIndex === 0 && "opacity-30 pointer-events-none"
                )}
                onClick={prevJob}
                disabled={currentJobIndex === 0}
                data-testid="button-prev-job"
                aria-label="Previous job"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              
              <div className="flex items-center gap-3" data-testid="text-job-counter">
                {todayJobs.map((_, idx) => (
                  <motion.button
                    key={idx}
                    onClick={() => setCurrentJobIndex(idx)}
                    className={cn(
                      "h-2 rounded-full transition-all duration-300",
                      idx === currentJobIndex 
                        ? "w-8 bg-white" 
                        : "w-2 bg-white/30 hover:bg-white/50"
                    )}
                  />
                ))}
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-10 w-10 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 text-white",
                  currentJobIndex >= todayJobs.length - 1 && "opacity-30 pointer-events-none"
                )}
                onClick={nextJob}
                disabled={currentJobIndex >= todayJobs.length - 1}
                data-testid="button-next-job"
                aria-label="Next job"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            {/* Job card */}
            <AnimatePresence mode="wait">
              {activeJob && (
                <motion.div 
                  key={activeJob.id}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="relative rounded-3xl overflow-hidden mb-8"
                  data-testid="card-current-job"
                >
                  {/* Glass card background */}
                  <div className="absolute inset-0 bg-white/5 backdrop-blur-2xl" />
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent" />
                  <div className="absolute inset-0 border border-white/10 rounded-3xl" />
                  
                  <div className="relative p-6 space-y-4">
                    {/* Status badge */}
                    <div className="flex items-center justify-between">
                      <motion.div 
                        className={cn(
                          "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-xl",
                          isJobComplete && "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
                          activeJob.status === 'in_progress' && "bg-blue-500/20 text-blue-300 border border-blue-500/30",
                          activeJob.status === 'scheduled' && "bg-white/10 text-white/70 border border-white/20"
                        )} 
                        data-testid="status-job-badge"
                      >
                        {isJobComplete && <CheckCircle2 className="h-3 w-3" />}
                        {activeJob.status === 'in_progress' && <Gauge className="h-3 w-3" />}
                        {activeJob.status === 'scheduled' && <Clock className="h-3 w-3" />}
                        {isJobComplete ? 'Completed' : 
                         activeJob.status === 'in_progress' ? 'In Progress' : 'Scheduled'}
                      </motion.div>
                      
                      {inProgressJobs.length > 0 && (
                        <span className="text-xs text-white/40" data-testid="text-active-jobs-count">
                          {inProgressJobs.length} active job{inProgressJobs.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    
                    {/* Job title */}
                    <div>
                      <h2 className="text-2xl font-bold text-white leading-tight" data-testid="text-job-title">
                        {activeJob.title}
                      </h2>
                      {activeJob.clientName && (
                        <p className="text-lg text-white/50 mt-1" data-testid="text-client-name">
                          {activeJob.clientName}
                        </p>
                      )}
                    </div>
                    
                    {/* Job details */}
                    <div className="flex flex-wrap gap-4">
                      {activeJob.scheduledTime && (
                        <div className="flex items-center gap-2 text-white/60" data-testid="text-scheduled-time">
                          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                            <Clock className="h-4 w-4" />
                          </div>
                          <span className="text-sm">{activeJob.scheduledTime}</span>
                        </div>
                      )}
                      {activeJob.location && (
                        <div className="flex items-center gap-2 text-white/60" data-testid="text-job-location">
                          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                            <MapPin className="h-4 w-4" />
                          </div>
                          <span className="text-sm truncate max-w-[180px]">{activeJob.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Recording indicator */}
            <AnimatePresence>
              {isRecording && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center justify-center gap-3 mb-6"
                >
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="w-3 h-3 rounded-full bg-rose-500"
                  />
                  <span className="text-lg font-medium text-white tabular-nums">
                    {formatTime(recordingDuration)}
                  </span>
                  <Volume2 className="h-5 w-5 text-rose-400 animate-pulse" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Spacer */}
            <div className="flex-1" />
          </>
        )}
      </div>

      {/* Action dock */}
      {todayJobs.length > 0 && (
        <div className="relative z-10 pb-8 pt-4 px-5">
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="relative rounded-3xl overflow-hidden"
          >
            {/* Dock background */}
            <div className="absolute inset-0 bg-white/5 backdrop-blur-2xl" />
            <div className="absolute inset-0 bg-gradient-to-t from-white/5 to-transparent" />
            <div className="absolute inset-0 border border-white/10 rounded-3xl" />
            
            <div className="relative flex items-center justify-center gap-6 p-5">
              {/* Voice Note Button */}
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={isRecording ? stopVoiceNote : startVoiceNote}
                disabled={isJobDisabled}
                className={cn(
                  "relative flex flex-col items-center justify-center w-20 h-20 rounded-2xl transition-all duration-300",
                  isRecording 
                    ? "bg-rose-500 shadow-lg shadow-rose-500/40" 
                    : "bg-white/10 hover:bg-white/15",
                  isJobDisabled && "opacity-40 pointer-events-none"
                )}
                data-testid="button-drive-voice-note"
              >
                {isRecording && (
                  <motion.div
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute inset-0 rounded-2xl bg-rose-500"
                  />
                )}
                <Mic className={cn(
                  "h-7 w-7 text-white relative z-10",
                  isRecording && "animate-pulse"
                )} />
                <span className="text-[10px] text-white/70 mt-1.5 relative z-10">
                  {isRecording ? 'Stop' : 'Voice'}
                </span>
              </motion.button>

              {/* Mark Complete Button - Primary action */}
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={handleMarkComplete}
                disabled={isJobDisabled || isMarkingComplete}
                className={cn(
                  "relative flex flex-col items-center justify-center w-24 h-24 rounded-3xl transition-all duration-300",
                  isJobComplete 
                    ? "bg-emerald-500/20 border-2 border-emerald-500/50" 
                    : "bg-emerald-500 shadow-lg shadow-emerald-500/40",
                  (isJobDisabled || isMarkingComplete) && !isJobComplete && "opacity-40 pointer-events-none"
                )}
                data-testid="button-drive-mark-complete"
              >
                {!isJobComplete && (
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 rounded-3xl bg-emerald-400/30"
                  />
                )}
                {isMarkingComplete ? (
                  <Loader2 className="h-9 w-9 text-white animate-spin relative z-10" />
                ) : (
                  <Check className={cn(
                    "h-9 w-9 relative z-10",
                    isJobComplete ? "text-emerald-400" : "text-white"
                  )} />
                )}
                <span className={cn(
                  "text-xs mt-1 relative z-10",
                  isJobComplete ? "text-emerald-400/70" : "text-white/90"
                )}>
                  {isJobComplete ? 'Done' : 'Complete'}
                </span>
              </motion.button>

              {/* Add Note Button */}
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => setShowNoteDialog(true)}
                disabled={isJobDisabled}
                className={cn(
                  "relative flex flex-col items-center justify-center w-20 h-20 rounded-2xl bg-white/10 hover:bg-white/15 transition-all duration-300",
                  isJobDisabled && "opacity-40 pointer-events-none"
                )}
                data-testid="button-drive-add-note"
              >
                <FileText className="h-7 w-7 text-white" />
                <span className="text-[10px] text-white/70 mt-1.5">Note</span>
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Note Dialog */}
      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent className="bg-slate-900/95 backdrop-blur-2xl border-white/10 text-white max-w-md mx-4 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Add Note</DialogTitle>
          </DialogHeader>
          <Textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="What would you like to remember?"
            className="min-h-[140px] text-base bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:ring-primary/50 rounded-xl resize-none"
            data-testid="input-drive-note"
          />
          <div className="flex gap-3 mt-2">
            <Button
              size="lg"
              variant="outline"
              className="flex-1 rounded-xl bg-white/5 border-white/10 text-white hover:bg-white/10"
              onClick={() => setShowNoteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              size="lg"
              className="flex-1 rounded-xl bg-primary hover:bg-primary/90"
              onClick={handleSaveNote}
              disabled={!noteContent.trim()}
              data-testid="button-save-drive-note"
            >
              Save Note
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success overlay */}
      <AnimatePresence>
        {actionFeedback === 'success' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="relative"
            >
              <motion.div
                animate={{ scale: [1, 2, 2], opacity: [0.6, 0, 0] }}
                transition={{ duration: 0.8 }}
                className="absolute inset-0 w-28 h-28 rounded-full bg-emerald-500"
              />
              <div className="w-28 h-28 rounded-full bg-emerald-500 flex items-center justify-center shadow-2xl shadow-emerald-500/50">
                <CheckCircle2 className="h-14 w-14 text-white" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
