// Define types for extraction components
export interface Branch {
  name: string;
  objectId: string;
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  areaPaths?: {
    extracted: boolean;
    count: number;
    items?: any[];
    error?: string;
  };
  iterationPaths?: {
    extracted: boolean;
    count: number;
    items?: any[];
    error?: string;
  };
  workItemTypes?: {
    extracted: boolean;
    count: number;
    items?: any[];
    error?: string;
  };
  workItems?: {
    extracted: boolean;
    count: number;
    items?: any[];
    workItemsByType?: any[];
    error?: string;
  };
  customFields?: {
    extracted: boolean;
    count: number;
    items?: any[];
    error?: string;
  };
  boardColumns?: {
    extracted: boolean;
    count: number;
    items?: any[];
    error?: string;
  };
  wikiPages?: {
    extracted: boolean;
    count: number;
    items?: any[];
    error?: string;
  };
  repositories?: {
    extracted: boolean;
    count: number;
    items?: any[];
    error?: string;
  };
  testCases?: {
    extracted: boolean;
    count: number;
    items?: any[];
    error?: string;
  };
  testSuites?: {
    extracted: boolean;
    count: number;
    items?: any[];
    error?: string;
  };
  testPlans?: {
    extracted: boolean;
    count: number;
    items?: any[];
    error?: string;
  };
  testResults?: {
    extracted: boolean;
    count: number;
    items?: any[];
    error?: string;
  };
  buildPipelines?: {
    extracted: boolean;
    count: number;
    items?: any[];
    error?: string;
  };
  releasePipelines?: {
    extracted: boolean;
    count: number;
    items?: any[];
    error?: string;
  };
  extractionHistory?: any[];
}

export type ArtifactType = 
  | "areapaths" 
  | "iterationpaths" 
  | "workitemtypes" 
  | "customfields" 
  | "boardcolumns" 
  | "wikipages" 
  | "repositories" 
  | "workitems" 
  | "testcases" 
  | "testsuites"
  | "testplans"
  | "testresults"
  | "buildpipelines"
  | "releasepipelines"
  | "pipelineruns";

export interface ExtractionJob {
  id: string;
  projectId: number;
  projectName: string;
  artifactType: ArtifactType;
  status: "queued" | "in_progress" | "completed" | "failed";
  progress?: number;
  extractedItems?: number;
  totalItems?: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}