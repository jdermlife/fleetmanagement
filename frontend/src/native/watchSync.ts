import { Capacitor, registerPlugin } from '@capacitor/core';

export interface WatchSnapshot {
  updatedAt: string;

  // Overall Financial Health score (0-1000)
  financialHealth?: {
    value?: number | null;
    trend?: number[];
  };

  // Phone-computed Financial Health group rings (0-100)
  goldRingScore?: number | null;
  silverRingScore?: number | null;
  bronzeRingScore?: number | null;

  // Credit Health data — retain for other Watch displays
  creditHealth?: {
    value?: number | null;
    creditScore?: number | null;
    creditBureauScore?: number | null;
    psychometricScore?: number | null;
    socialScore?: number | null;
    nonStarterScore?: number | null;
    creditFilscore?: number | null;
    creditBureauFilscore?: number | null;
    psychometricFilscore?: number | null;
    socialFilscore?: number | null;
    nonStarterFilscore?: number | null;
    trend?: number[];
  };

  // Wealth Building data — retain for other Watch displays
  wealthBuilding?: {
    value?: number | null;
    grade?: string | null;
    rating?: string | null;
    netWorthStrength?: number | null;
    liquidityBuffer?: number | null;
    cashFlowStrength?: number | null;
    leverageControl?: number | null;
    emergencyReadiness?: number | null;
    investmentReadiness?: number | null;
    retirementReadiness?: number | null;
    financialIndependence?: number | null;
    goalMomentum?: number | null;
    protectionCoverage?: number | null;
    trend?: number[];
  };

  wealthBalance?: {
    netWorthPositioning?: number | null;
    wealthBehaviour?: number | null;
    wealthFoundation?: number | null;
    wealthAuthenticity?: number | null;
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
    net?: number | null;
    variance?: number | null;
    performanceBand?: string | null;
    trend?: number[];
  };

  budgetUtilization?: {
    budgetAmount?: number | null;
    utilizedAmount?: number | null;
    utilizationPercent?: number | null;
    progressPercent?: number | null;
    overflowPercent?: number | null;
    remainingAmount?: number | null;
    overBudgetAmount?: number | null;
    sourceLabel?: string | null;
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

  billCalendar?: {
    snapshotMonth?: string | null;
    lateCount?: number | null;
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

const nativeWatchSync = registerPlugin<WatchSyncPlugin>('WatchSync');

export const WatchSync: WatchSyncPlugin = {
  updateSnapshot(options) {
    if (!Capacitor.isNativePlatform()) {
      return Promise.resolve({ saved: false, sent: false });
    }
    return nativeWatchSync.updateSnapshot(options);
  },
};