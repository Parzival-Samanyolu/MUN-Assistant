import { DetailLevel } from './services/geminiService';

export interface HistoryItem {
  id: string;
  country: string;
  topic: string;
  detailLevel: DetailLevel;
  summary: string;
  timestamp: number;
}
