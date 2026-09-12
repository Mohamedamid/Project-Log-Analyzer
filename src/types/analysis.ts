export type PageId = "dashboard" | "analysis" | "history" | "gitlab";
export type Theme = "light" | "dark";

export interface TimelineStep {
  type: string;
  name: string;
  args: string[];
  status: string;
  elapsed: string;
  inFailedPath: boolean;
  errorMessage: string;
}

export interface ScreenshotRef {
  ref: string;
  label: string;
  url: string;
  foundLocalFile: boolean;
}

export interface SuitePathItem {
  id: string;
  name: string;
}

export interface TestCase {
  id: string;
  moduleId: string;
  moduleName: string;
  sourceFile: string;
  status: string;
  caseName: string;
  keyword: string;
  errorMessage: string;
  timeline: TimelineStep[];
  startTime: string;
  elapsed: string;
  tags: string[];
  documentation: string;
  screenshots: ScreenshotRef[];
  suitePath: SuitePathItem[];
  suiteIds: string[];
}

export interface SuiteNode {
  id: string;
  name: string;
  children: SuiteNode[];
  testCount: number;
  failCount: number;
}

export interface AnalysisModule {
  id: string;
  name: string;
  sourceFile: string;
  failedCount: number;
  successCount: number;
  testCount: number;
  suiteTree: SuiteNode | null;
}

export interface AnalysisData {
  totalCount: number;
  successCount: number;
  failedCount: number;
  cases: TestCase[];
  failures: TestCase[];
  modules: AnalysisModule[];
}

export interface AnalysisStats {
  total: number;
  failures: number;
  success: number;
  fixed: number;
  blocked: number;
  other: number;
  modules: number;
}

export interface HistoryRecord {
  id: number;
  createdAt: string;
  stats: AnalysisStats;
  data: AnalysisData;
}

export interface FileWithPath extends File {
  readonly webkitRelativePath: string;
  relativePathForDisplay?: string;
}
