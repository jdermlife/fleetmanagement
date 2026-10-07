import { registerPlugin } from '@capacitor/core';

export interface WatchSnapshot {
  updatedAt: string;

  filsScore?: {
    value?: number | null;
    grade?: string | null;
    rating?: string | null;
    trend?: number[];
  };

  wealthBuilding?: {
    value?: number | null;
    grade?: string | null;
    rating?: string | null;
    trend?: number[];
  };

  
  financialHealth?: {
    value?: number | null;
    trend?: number[];
  };

  netWorth?: {
    actual?: number | null;
    target?: number | null;
    projected?: number | null;
    trend?: number[];
  };

  budget?: {
    score?: number | null;
    income?: number | null;
    expenses?: number | null;
    utilizationPercent?: number | null;
    trend?: number[];
  };

  loanMonitoring?: {
    score?: number | null;
    status?: string | null;
    trend?: number[];
  };

  bills?: {
    total?: number | null;
    paid?: number | null;
    outstanding?: number | null;
    trend?: number[];
  };
}

interface WatchSyncPlugin {
  updateSnapshot(options: {
    snapshot: WatchSnapshot;
  }): Promise<{
    saved: boolean;
    sent: boolean;
  }>;
}

export const WatchSync =
  registerPlugin<WatchSyncPlugin>('WatchSync');