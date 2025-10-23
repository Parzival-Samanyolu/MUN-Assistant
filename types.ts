export type DetailLevel = 'concise' | 'standard' | 'detailed';

export interface Source {
  uri: string;
  title: string;
}

export interface HistoryItem {
  id: string;
  country: string;
  topic: string;
  detailLevel: DetailLevel;
  includeHistory: boolean;
  summary: string;
  timestamp: string;
  sources?: Source[];
}
