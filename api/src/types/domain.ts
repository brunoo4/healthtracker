export interface DailyMetrics {
  id: string;
  date: string;
  restingHeartRate: number | null;
  hrv: number | null;
  bodyBatteryMax: number | null;
  bodyBatteryMin: number | null;
  stressAvg: number | null;
  sleepDuration: number | null;
  sleepScore: number | null;
  steps: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Activities {
  id: string;
  garminActivityId: string;
  type: string;
  startedAt: Date;
  duration: number;
  distance: number | null;
  avgPace: string | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  avgCadence: number | null;
  elevationGain: number | null;
  trainingLoad: number | null;
  createdAt: Date;
}

export interface SyncLogs {
  id: string;
  startedAt: Date;
  finishedAt: Date;
  status: string;
  recordsProcessed: number;
  errorMessage: string | null;
}
