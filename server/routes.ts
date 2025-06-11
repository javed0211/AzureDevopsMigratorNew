import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAdoConnectionSchema, insertProjectSchema, insertMigrationJobSchema } from "@shared/schema";
import { z } from "zod";

// Mock Azure DevOps API integration
class AzureDevOpsClient {
  private patToken: string;
  private baseUrl: string;

  constructor(baseUrl: string, patToken: string) {
    this.baseUrl = baseUrl;
    this.patToken = patToken;
  }

  async getProjects() {
    // In a real implementation, this would call Azure DevOps REST API
    // For now, return mock data that matches the design
    return [
      {
        id: "project-1",
        name: "Customer Portal v2",
        description: "Next generation customer portal",
        processTemplate: "Agile",
        sourceControl: "Git",
        visibility: "Private",
        createdDate: new Date("2023-12-15"),
        workItemCount: 247,
        repoCount: 12,
        testCaseCount: 89,
        pipelineCount: 15,
      },
      {
        id: "project-2",
        name: "Mobile App Backend",
        description: "API services for mobile applications",
        processTemplate: "Scrum",
        sourceControl: "Git",
        visibility: "Private",
        createdDate: new Date("2023-11-28"),
        workItemCount: 156,
        repoCount: 8,
        testCaseCount: 45,
        pipelineCount: 12,
      },
      {
        id: "project-3",
        name: "Data Analytics Platform",
        description: "Big data processing and analytics",
        processTemplate: "CMMI",
        sourceControl: "Git",
        visibility: "Private",
        createdDate: new Date("2023-10-10"),
        workItemCount: 89,
        repoCount: 5,
        testCaseCount: 34,
        pipelineCount: 8,
      },
      {
        id: "project-4",
        name: "Legacy System Migration",
        description: "Migration of legacy mainframe systems",
        processTemplate: "Agile",
        sourceControl: "TFVC",
        visibility: "Private",
        createdDate: new Date("2023-09-05"),
        workItemCount: 312,
        repoCount: 3,
        testCaseCount: 78,
        pipelineCount: 6,
      },
      {
        id: "project-5",
        name: "DevOps Automation",
        description: "CI/CD pipeline automation tools",
        processTemplate: "Scrum",
        sourceControl: "Git",
        visibility: "Private",
        createdDate: new Date("2023-08-12"),
        workItemCount: 98,
        repoCount: 7,
        testCaseCount: 23,
        pipelineCount: 18,
      },
    ];
  }

  async testConnection(): Promise<boolean> {
    // In a real implementation, this would test the ADO connection
    return true;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // ADO Connections
  app.get("/api/connections", async (req, res) => {
    try {
      const connections = await storage.getAdoConnections();
      res.json(connections);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch connections" });
    }
  });

  app.post("/api/connections", async (req, res) => {
    try {
      const validatedData = insertAdoConnectionSchema.parse(req.body);
      const connection = await storage.createAdoConnection(validatedData);
      res.status(201).json(connection);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create connection" });
      }
    }
  });

  app.post("/api/connections/:id/test", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const connection = await storage.getAdoConnection(id);
      
      if (!connection) {
        return res.status(404).json({ message: "Connection not found" });
      }

      const client = new AzureDevOpsClient(connection.baseUrl, connection.patToken);
      const isValid = await client.testConnection();
      
      res.json({ valid: isValid });
    } catch (error) {
      res.status(500).json({ message: "Failed to test connection" });
    }
  });

  // Projects
  app.get("/api/projects", async (req, res) => {
    try {
      const connectionId = req.query.connectionId ? parseInt(req.query.connectionId as string) : undefined;
      const projects = await storage.getProjects(connectionId);
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.post("/api/projects/sync", async (req, res) => {
    try {
      const { connectionId } = req.body;
      const connection = await storage.getAdoConnection(connectionId);
      
      if (!connection) {
        return res.status(404).json({ message: "Connection not found" });
      }

      const client = new AzureDevOpsClient(connection.baseUrl, connection.patToken);
      const adoProjects = await client.getProjects();

      const syncedProjects = [];
      for (const adoProject of adoProjects) {
        const project = await storage.createProject({
          externalId: adoProject.id,
          name: adoProject.name,
          description: adoProject.description,
          processTemplate: adoProject.processTemplate,
          sourceControl: adoProject.sourceControl,
          visibility: adoProject.visibility,
          createdDate: adoProject.createdDate,
          status: "ready",
          connectionId,
          workItemCount: adoProject.workItemCount,
          repoCount: adoProject.repoCount,
          testCaseCount: adoProject.testCaseCount,
          pipelineCount: adoProject.pipelineCount,
        });
        syncedProjects.push(project);
      }

      res.json(syncedProjects);
    } catch (error) {
      res.status(500).json({ message: "Failed to sync projects" });
    }
  });

  app.patch("/api/projects/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      
      const project = await storage.updateProjectStatus(id, status);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: "Failed to update project status" });
    }
  });

  app.post("/api/projects/bulk-select", async (req, res) => {
    try {
      const { projectIds, status } = req.body;
      
      const updatedProjects = [];
      for (const id of projectIds) {
        const project = await storage.updateProjectStatus(id, status);
        if (project) {
          updatedProjects.push(project);
        }
      }
      
      res.json(updatedProjects);
    } catch (error) {
      res.status(500).json({ message: "Failed to update projects" });
    }
  });

  // Migration Jobs
  app.get("/api/migration-jobs", async (req, res) => {
    try {
      const jobs = await storage.getMigrationJobs();
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch migration jobs" });
    }
  });

  app.post("/api/migration-jobs", async (req, res) => {
    try {
      const validatedData = insertMigrationJobSchema.parse(req.body);
      const job = await storage.createMigrationJob(validatedData);
      res.status(201).json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create migration job" });
      }
    }
  });

  // Audit Logs
  app.get("/api/audit-logs", async (req, res) => {
    try {
      const jobId = req.query.jobId ? parseInt(req.query.jobId as string) : undefined;
      const logs = await storage.getAuditLogs(jobId);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // Statistics
  app.get("/api/statistics", async (req, res) => {
    try {
      const projects = await storage.getProjects();
      const jobs = await storage.getMigrationJobs();
      
      const stats = {
        totalProjects: projects.length,
        selectedProjects: projects.filter(p => p.status === "selected").length,
        inProgressProjects: projects.filter(p => ["extracting", "migrating"].includes(p.status)).length,
        migratedProjects: projects.filter(p => p.status === "migrated").length,
        totalJobs: jobs.length,
        runningJobs: jobs.filter(j => j.status === "running").length,
        completedJobs: jobs.filter(j => j.status === "completed").length,
        failedJobs: jobs.filter(j => j.status === "failed").length,
      };
      
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
