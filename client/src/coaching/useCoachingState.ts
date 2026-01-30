import { useState, useEffect } from 'react';

const STORAGE_KEY = 'gigaid_coaching_seen';

export function useCoachingState() {
  const [seen, setSeen] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
    } catch {
      // localStorage not available
    }
  }, [seen]);

  const markSeen = (id: string) => {
    if (!seen.includes(id)) {
      setSeen(prev => [...prev, id]);
    }
  };

  const hasSeen = (id: string) => seen.includes(id);

  const reset = () => setSeen([]);

  return { hasSeen, markSeen, reset };
}
