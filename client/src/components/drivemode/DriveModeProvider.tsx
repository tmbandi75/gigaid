import { createContext, useContext, useEffect } from 'react';
import { useDriveMode } from '@/hooks/useDriveMode';
import { DriveModePrompt } from './DriveModePrompt';
import { DriveModeView } from './DriveModeView';
import { OfflineStatusBar } from '@/components/offline/OfflineIndicator';
import { initializeSync } from '@/lib/offlineSync';
import { GpsStatus } from '@/hooks/useMotionDetection';

interface DriveModeContextValue {
  isDriveMode: boolean;
  enterDriveMode: () => void;
  exitDriveMode: () => void;
  gpsStatus: GpsStatus;
  currentSpeed: number | null;
}

const DriveModeContext = createContext<DriveModeContextValue>({
  isDriveMode: false,
  enterDriveMode: () => {},
  exitDriveMode: () => {},
  gpsStatus: 'inactive',
  currentSpeed: null,
});

export function useDriveModeContext() {
  return useContext(DriveModeContext);
}

interface DriveModeProviderProps {
  children: React.ReactNode;
}

export function DriveModeProvider({ children }: DriveModeProviderProps) {
  const {
    isDriveMode,
    showSuggestion,
    acceptDriveMode,
    declineDriveMode,
    enterDriveMode,
    exitDriveMode,
    gpsStatus,
    currentSpeed,
  } = useDriveMode();

  useEffect(() => {
    initializeSync();
  }, []);

  return (
    <DriveModeContext.Provider value={{ isDriveMode, enterDriveMode, exitDriveMode, gpsStatus, currentSpeed }}>
      <OfflineStatusBar />
      
      {isDriveMode ? (
        <DriveModeView onExit={exitDriveMode} />
      ) : (
        children
      )}

      <DriveModePrompt
        open={showSuggestion && !isDriveMode}
        onSwitch={acceptDriveMode}
        onNotNow={declineDriveMode}
      />
    </DriveModeContext.Provider>
  );
}
