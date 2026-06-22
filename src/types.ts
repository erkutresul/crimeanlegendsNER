export interface PaperInfo {
  title: string;
  authors: string;
  institution: string;
  abstract: string;
  journal: string;
  doi: string;
  keywords: string;
}

export interface DataRow {
  id: string;
  [key: string]: string | number; // flexible cell values
}

export interface MetricDefinition {
  key: string;
  label: string;
  unit: string;
  isNumeric: boolean;
}

export interface Dataset {
  id: string;
  name: string;
  description: string;
  columns: MetricDefinition[];
  data: DataRow[];
  defaultX: string;
  defaultY: string;
}

export type ChartType = 'line' | 'scatter' | 'bar' | 'radar' | 'heatmap';

export interface VisualizerState {
  currentDatasetId: string;
  activeChartType: ChartType;
  selectedX: string;
  selectedY: string;
  selectedY2: string; // for dual-axis line charts (empty string if none)
  showRegressionLine: boolean;
  showErrorBars: boolean;
}
