import type { ChartTypeId } from './chartTypes';

export interface Annotation {
  period: string;
  label: string;
  description: string;
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
  kpiTitle: string;
  kpiSubtitle: string;
  kpiDescription: string;
  annotations: Annotation[];
}
