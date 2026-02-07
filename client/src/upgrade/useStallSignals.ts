import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { useCanPerform } from "@/hooks/useCapability";
import { STALL_THRESHOLDS } from "./upgradeConfig";
import type { StallSummary } from "./upgradeTypes";

interface StallSignals {
  stalledTypes: StallSummary[];
  topStall: StallSummary | null;
  hasActionableStall: boolean;
  loading: boolean;
}

const LOCAL_COUNTER_KEY = "gigaid_stall_counters";

interface LocalStallCounters {
  manual_followup_repeat: { count: number; windowStart: number };
  missed_deposit: { count: number; windowStart: number };
  unpaid_invoice: { count: number; windowStart: number };
  message_thread_overflow: { count: number; windowStart: number };
}

function getLocalCounters(): LocalStallCounters {
  try {
    const raw = localStorage.getItem(LOCAL_COUNTER_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const now = Date.now();
  return {
    manual_followup_repeat: { count: 0, windowStart: now },
    missed_deposit: { count: 0, windowStart: now },
    unpaid_invoice: { count: 0, windowStart: now },
    message_thread_overflow: { count: 0, windowStart: now },
  };
}

function saveLocalCounters(counters: LocalStallCounters): void {
  try {
    localStorage.setItem(LOCAL_COUNTER_KEY, JSON.stringify(counters));
  } catch {}
}

export function incrementStallCounter(stallType: keyof LocalStallCounters): void {
  const counters = getLocalCounters();
  const now = Date.now();
  const windowMs = 48 * 60 * 60 * 1000;

  const entry = counters[stallType];
  if (now - entry.windowStart > windowMs) {
    entry.count = 1;
    entry.windowStart = now;
  } else {
    entry.count += 1;
  }

  saveLocalCounters(counters);
}

export function getLocalStallSummaries(): StallSummary[] {
  const counters = getLocalCounters();
  const now = Date.now();
  const windowMs = 48 * 60 * 60 * 1000;
  const results: StallSummary[] = [];

  for (const [type, entry] of Object.entries(counters)) {
    if (now - entry.windowStart > windowMs) continue;
    const threshold = STALL_THRESHOLDS[type] || 3;
    if (entry.count >= threshold) {
      results.push({
        stallType: type,
        count: entry.count,
        totalMoneyAtRisk: 0,
      });
    }
  }

  return results;
}

export function useStallSignals(): StallSignals {
  const autoFollowup = useCanPerform("sms.auto_followups");
  const mergedRef = useRef(false);

  const { data: serverStalls, isLoading } = useQuery<StallSummary[]>({
    queryKey: [...QUERY_KEYS.stallDetections(), "summary"],
    staleTime: 300000,
    enabled: !autoFollowup.unlimited,
  });

  const [stalledTypes, setStalledTypes] = useState<StallSummary[]>([]);

  useEffect(() => {
    if (mergedRef.current) return;

    const local = getLocalStallSummaries();
    const server = serverStalls || [];

    const merged = new Map<string, StallSummary>();
    for (const s of server) {
      merged.set(s.stallType, s);
    }
    for (const l of local) {
      const existing = merged.get(l.stallType);
      if (!existing || l.count > existing.count) {
        merged.set(l.stallType, l);
      }
    }

    const result = Array.from(merged.values());
    if (result.length > 0) {
      setStalledTypes(result);
      mergedRef.current = true;
    }
  }, [serverStalls]);

  let topStall: StallSummary | null = null;
  for (const s of stalledTypes) {
    if (!topStall || s.count > topStall.count || (s.count === topStall.count && s.totalMoneyAtRisk > topStall.totalMoneyAtRisk)) {
      topStall = s;
    }
  }

  return {
    stalledTypes,
    topStall,
    hasActionableStall: stalledTypes.length > 0,
    loading: isLoading,
  };
}

