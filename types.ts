export type DetailLevel = 'concise' | 'standard' | 'detailed';

export interface HistoryItem {
  id: string;
  country: string;
  topic: string;
  detailLevel: DetailLevel;
  includeHistory: boolean;
  summary: string;
  timestamp: string;
}
