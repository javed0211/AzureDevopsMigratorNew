import { apiRequest } from "./queryClient";
import type { AdoConnection, Project, MigrationJob, AuditLog } from "@shared/schema";

export const api = {
  // Logs
  logs: {
    getSummary: () => 
      apiRequest("GET", "/api/logs/summary").then(res => res.json()),
    
    getLogs: (params: { level?: string; search?: string; offset?: number; limit?: number }) => {
      const queryParams = new URLSearchParams();
      if (params.level) queryParams.append("level", params.level);
      if (params.search) queryParams.append("search", params.search);
      if (params.offset !== undefined) queryParams.append("offset", params.offset.toString());
      if (params.limit !== undefined) queryParams.append("limit", params.limit.toString());
      
      return apiRequest("GET", `/api/logs?${queryParams.toString()}`).then(res => res.json());
    }
  },

  // Work Items API

  // Projects - Updated for Python FastAPI backend
  projects: {
    getAll: (): Promise<Project[]> => 
      apiRequest("GET", "/api/projects").then(res => res.json()),
    
    getSelected: (): Promise<Project[]> =>
      apiRequest("GET", "/api/projects/selected").then(res => res.json()),
    
    sync: (connectionId: number) =>
      fetch(`/api/projects/sync/${connectionId}`, {
        method: "POST",
      }).then((res) => {
        if (!res.ok) throw new Error("Sync failed");
        return res.json();
      }),     
    
    updateStatus: (id: number, status: string): Promise<Project> =>
      apiRequest("PATCH", `/api/projects/${id}/status?status=${status}`).then(res => res.json()),
    
    bulkUpdateStatus: (projectIds: number[], status: string): Promise<Project[]> =>
      apiRequest("POST", "/api/projects/bulk-status", { project_ids: projectIds, status }).then(res => res.json()),
    
    extract: (projectIds: number[], artifactTypes: string[]): Promise<{ message: string; projectIds: number[] }> =>
      apiRequest("POST", "/api/projects/extract", { projectIds, artifactTypes }).then(res => res.json()),
      
    getRepositories: (projectId: number) => 
      apiRequest("GET", `/api/projects/${projectId}/repositories`).then(res => res.json()),
      
    getMigrationSummary: (projectId: number) =>
      apiRequest("GET", `/api/projects/${projectId}/migration-summary`).then(res => res.json()),
      
    getWorkItems: (projectId: number) =>
      apiRequest("GET", `/api/projects/${projectId}/workitems`).then(res => res.json()),
      
    getAreaPaths: (projectId: number) =>
      apiRequest("GET", `/api/projects/${projectId}/areapaths`).then(res => res.json()),
      
    getIterationPaths: (projectId: number) =>
      apiRequest("GET", `/api/projects/${projectId}/iterationpaths`).then(res => res.json()),
      
    getWorkItemTypes: (projectId: number) =>
      apiRequest("GET", `/api/projects/${projectId}/workitemtypes`).then(res => res.json()),
      
    getCustomFields: (projectId: number) =>
      apiRequest("GET", `/api/projects/${projectId}/customfields`).then(res => res.json()),
      
    getBoardColumns: (projectId: number) =>
      apiRequest("GET", `/api/projects/${projectId}/boardcolumns`).then(res => res.json()),
      
    getWikiPages: (projectId: number) =>
      apiRequest("GET", `/api/projects/${projectId}/wikipages`).then(res => res.json()),
      
    getExtractionHistory: (projectId: number) => 
      apiRequest("GET", `/api/projects/${projectId}/extraction-history`).then(res => res.json()),
  },
  
  repositories: {
    getDetails: (repoId: number) =>
      apiRequest("GET", `/api/repositories/${repoId}/details`).then(res => res.json()),
  },
  
  workItems: {
    getDetails: (workItemId: number) =>
      apiRequest("GET", `/api/workitems/${workItemId}`).then(res => res.json()),
  },
  
  extraction: {
    getJobs: () => 
      apiRequest("GET", "/api/extraction/jobs").then(res => res.json()),
      
    startJob: (projectId: number, artifactType: string) =>
      apiRequest("POST", "/api/extraction/start", { projectId, artifactType }).then(res => res.json()),
  },

  // Statistics - Updated for Python FastAPI backend
  statistics: {
    get: (): Promise<{
      totalProjects: number;
      selectedProjects: number;
      inProgressProjects: number;
      migratedProjects: number;
    }> => apiRequest("GET", "/api/statistics").then(res => res.json()),
  },

  // Legacy API compatibility - to be removed when not needed
  connections: {
    getAll: (): Promise<AdoConnection[]> => 
      apiRequest("GET", "/api/connections").then(res => res.json()),
    
    create: (connection: Omit<AdoConnection, "id" | "createdAt">): Promise<AdoConnection> =>
      apiRequest("POST", "/api/connections", connection).then(res => res.json()),
    
    test: (id: number): Promise<{ valid: boolean }> =>
      apiRequest("POST", `/api/connections/${id}/test`).then(res => res.json()),
  },

  migrationJobs: {
    getAll: (): Promise<MigrationJob[]> =>
      apiRequest("GET", "/api/migration-jobs").then(res => res.json()),
    
    create: (job: Omit<MigrationJob, "id" | "startedAt" | "completedAt">): Promise<MigrationJob> =>
      apiRequest("POST", "/api/migration-jobs", job).then(res => res.json()),
  },

  auditLogs: {
    getAll: (jobId?: number): Promise<AuditLog[]> => {
      const url = jobId 
        ? `/api/audit-logs?jobId=${jobId}`
        : "/api/audit-logs";
      return apiRequest("GET", url).then(res => res.json());
    },
  },
};
