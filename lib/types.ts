import type { ChartTypeId } from './chartTypes';

export interface ChartBlock {
  id: string;
  dataRaw: string;
  fileName: string | null;
  context: string;
  instructions: string;
  chartType: ChartTypeId | null;
  insights: string[];
  isGeneratingInsights: boolean;
}

