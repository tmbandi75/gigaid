import { WifiOff, Cloud, CloudOff } from 'lucide-react';
import { useNetworkStatus, usePendingSync } from '@/hooks/useOffline';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface OfflineIndicatorProps {
  className?: string;
  showPending?: boolean;
}

export function OfflineIndicator({ className, showPending = true }: OfflineIndicatorProps) {
  const networkStatus = useNetworkStatus();
  const { total } = usePendingSync();

  if (networkStatus === 'online' && total === 0) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-2', className)} data-testid="offline-indicator">
      {networkStatus === 'offline' ? (
        <Badge variant="outline" className="gap-1.5 text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
          <WifiOff className="h-3 w-3" />
          Offline
        </Badge>
      ) : total > 0 ? (
        <Badge variant="outline" className="gap-1.5 text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
          <Cloud className="h-3 w-3 animate-pulse" />
          Syncing {total}
        </Badge>
      ) : null}
    </div>
  );
}

export function OfflineStatusBar() {
  const networkStatus = useNetworkStatus();
  const { total } = usePendingSync();

  if (networkStatus === 'online' && total === 0) {
    return null;
  }

  return (
    <div 
      className={cn(
        'fixed top-0 left-0 right-0 z-50 py-1 px-4 text-center text-sm font-medium',
        networkStatus === 'offline' 
          ? 'bg-amber-500 text-white' 
          : 'bg-blue-500 text-white'
      )}
      data-testid="offline-status-bar"
    >
      {networkStatus === 'offline' ? (
        <span className="flex items-center justify-center gap-2">
          <WifiOff className="h-4 w-4" />
          You're offline — changes will sync when connected
        </span>
      ) : (
        <span className="flex items-center justify-center gap-2">
          <Cloud className="h-4 w-4 animate-pulse" />
          Syncing {total} pending {total === 1 ? 'item' : 'items'}...
        </span>
      )}
    </div>
  );
}
