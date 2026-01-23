import { createContext, useContext, useEffect } from 'react';
import { useDriveMode } from '@/hooks/useDriveMode';
import { DriveModePrompt } from './DriveModePrompt';
import { DriveModeView } from './DriveModeView';
import { OfflineStatusBar } from '@/components/offline/OfflineIndicator';
import { initializeSync } from '@/lib/offlineSync';

interface DriveModeContextValue {
  isDriveMode: boolean;
  enterDriveMode: () => void;
  exitDriveMode: () => void;
}

const DriveModeContext = createContext<DriveModeContextValue>({
  isDriveMode: false,
  enterDriveMode: () => {},
  exitDriveMode: () => {},
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
  } = useDriveMode();

  useEffect(() => {
    initializeSync();
  }, []);

  return (
    <DriveModeContext.Provider value={{ isDriveMode, enterDriveMode, exitDriveMode }}>
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
