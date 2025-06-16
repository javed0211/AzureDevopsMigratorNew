export interface MigrationSummary {
  projectId: number;
  projectName: string;
  extractionStatus: {
    workItems: boolean;
    repositories: boolean;
    pipelines: boolean;
    areaPaths: boolean;
    iterationPaths: boolean;
    metadata: boolean;
    customFields: boolean;
    users: boolean;
  };
  counts: {
    workItems: number;
    repositories: number;
    pipelines: number;
    areaPaths: number;
    iterationPaths: number;
    revisions: number;
    comments: number;
    attachments: number;
    relations: number;
  };
  workItemTypes: Record<string, number>;
  repositories: {
    id: number;
    name: string;
    defaultBranch: string;
    branchCount: number;
  }[];
  migrationReadiness: {
    classification: boolean;
    workItems: boolean;
    workItemHistory: boolean;
    workItemComments: boolean;
    workItemAttachments: boolean;
    workItemRelations: boolean;
    repositories: boolean;
  };
}

export interface WorkItem {
  id: number;
  externalId: number;
  title: string;
  workItemType: string;
  state: string;
  assignedTo: string;
  areaPath: string;
  iterationPath: string;
  revisionCount: number;
  commentCount: number;
  attachmentCount: number;
  relationCount: number;
}

export interface AreaPath {
  id: number;
  externalId: string;
  name: string;
  path: string;
  parentPath: string;
  hasChildren: boolean;
}

export interface IterationPath {
  id: number;
  externalId: string;
  name: string;
  path: string;
  parentPath: string;
  startDate: string | null;
  endDate: string | null;
  hasChildren: boolean;
}

export interface CustomField {
  id: number;
  name: string;
  referenceName: string;
  type: string;
  usage: number;
  workItemTypes: string[];
}

export interface User {
  id: number;
  displayName: string;
  email: string;
  uniqueName: string;
  workItemCount: number;
}