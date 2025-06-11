import { apiRequest } from "./queryClient";
import type { AdoConnection, Project, MigrationJob, AuditLog } from "@shared/schema";

export const api = {
  // Connections
  connections: {
    getAll: (): Promise<AdoConnection[]> => 
      apiRequest("GET", "/api/connections").then(res => res.json()),
    
    create: (connection: Omit<AdoConnection, "id" | "createdAt">): Promise<AdoConnection> =>
      apiRequest("POST", "/api/connections", connection).then(res => res.json()),
    
    test: (id: number): Promise<{ valid: boolean }> =>
      apiRequest("POST", `/api/connections/${id}/test`).then(res => res.json()),
  },

  // Projects
  projects: {
    getAll: (connectionId?: number): Promise<Project[]> => {
      const url = connectionId 
        ? `/api/projects?connectionId=${connectionId}`
        : "/api/projects";
      return apiRequest("GET", url).then(res => res.json());
    },
    
    sync: (connectionId: number): Promise<Project[]> =>
      apiRequest("POST", "/api/projects/sync", { connectionId }).then(res => res.json()),
    
    updateStatus: (id: number, status: string): Promise<Project> =>
      apiRequest("PATCH", `/api/projects/${id}/status`, { status }).then(res => res.json()),
    
    bulkSelect: (projectIds: number[], status: string): Promise<Project[]> =>
      apiRequest("POST", "/api/projects/bulk-select", { projectIds, status }).then(res => res.json()),
  },

  // Migration Jobs
  migrationJobs: {
    getAll: (): Promise<MigrationJob[]> =>
      apiRequest("GET", "/api/migration-jobs").then(res => res.json()),
    
    create: (job: Omit<MigrationJob, "id" | "startedAt" | "completedAt">): Promise<MigrationJob> =>
      apiRequest("POST", "/api/migration-jobs", job).then(res => res.json()),
  },

  // Audit Logs
  auditLogs: {
    getAll: (jobId?: number): Promise<AuditLog[]> => {
      const url = jobId 
        ? `/api/audit-logs?jobId=${jobId}`
        : "/api/audit-logs";
      return apiRequest("GET", url).then(res => res.json());
    },
  },

  // Statistics
  statistics: {
    get: (): Promise<{
      totalProjects: number;
      selectedProjects: number;
      inProgressProjects: number;
      migratedProjects: number;
      totalJobs: number;
      runningJobs: number;
      completedJobs: number;
      failedJobs: number;
    }> => apiRequest("GET", "/api/statistics").then(res => res.json()),
  },
};
