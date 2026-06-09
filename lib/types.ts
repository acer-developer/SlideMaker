import type { ChartTypeId } from './chartTypes';

export interface Annotation {
  period: string;
  label: string;
  description: string;
  icon: string;
}

export interface ChartBlock {
  id: string;
  dataRaw: string;
  fileName: string | null;
  context: string;
  instructions: string;
  chartType: ChartTypeId | null;
  insights: string[];
  isGeneratingInsights: boolean;
  // AI-generated fields
  kpiTitle: string;
  kpiSubtitle: string;
  kpiDescription: string;
  kpiIcon: string;
  annotations: Annotation[];
  source: string;
  slideSubtitle: string;
}
