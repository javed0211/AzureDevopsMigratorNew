import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAdoConnectionSchema, insertProjectSchema, insertMigrationJobSchema } from "@shared/schema";
import { z } from "zod";

// Azure DevOps API integration
class AzureDevOpsClient {
  private patToken: string;
  private baseUrl: string;
  private organization: string;

  constructor(baseUrl: string, patToken: string) {
    this.baseUrl = baseUrl;
    this.patToken = patToken;
    this.organization = baseUrl.split('/').pop() || '';
  }

  private getAuthHeaders() {
    return {
      'Authorization': `Basic ${Buffer.from(`:${this.patToken}`).toString('base64')}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  private async makeRequest(endpoint: string) {
    const url = `https://dev.azure.com/${this.organization}/${endpoint}`;
    console.log(`Making request to: ${url}`);
    
    try {
      const response = await fetch(url, {
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error making request to ${url}:`, error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest('_apis/projects?api-version=7.0');
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  async getProjects() {
    try {
      const response = await this.makeRequest('_apis/projects?api-version=7.0');
      const projects = response.value || [];
      
      const projectsWithDetails = await Promise.all(
        projects.map(async (project: any) => {
          try {
            // Get project details
            const details = await this.makeRequest(`_apis/projects/${project.id}?includeCapabilities=true&api-version=7.0`);
            
            // Get work item count
            const workItemsResponse = await this.makeRequest(`${project.name}/_apis/wit/wiql?api-version=7.0`).catch(() => ({ workItems: [] }));
            const workItemCount = workItemsResponse?.workItems?.length || 0;
            
            // Get repositories
            const reposResponse = await this.makeRequest(`${project.name}/_apis/git/repositories?api-version=7.0`).catch(() => ({ value: [] }));
            const repoCount = reposResponse?.value?.length || 0;
            
            // Get pipelines
            const pipelinesResponse = await this.makeRequest(`${project.name}/_apis/pipelines?api-version=7.0`).catch(() => ({ value: [] }));
            const pipelineCount = pipelinesResponse?.value?.length || 0;
            
            // Get test plans
            const testPlansResponse = await this.makeRequest(`${project.name}/_apis/test/plans?api-version=7.0`).catch(() => ({ value: [] }));
            const testCaseCount = testPlansResponse?.value?.length || 0;

            return {
              id: project.id,
              name: project.name,
              description: project.description || '',
              processTemplate: details.capabilities?.processTemplate?.templateName || 'Unknown',
              sourceControl: details.capabilities?.versioncontrol?.sourceControlType || 'Git',
              visibility: project.visibility || 'Private',
              createdDate: new Date(project.lastUpdateTime || Date.now()),
              workItemCount,
              repoCount,
              testCaseCount,
              pipelineCount
            };
          } catch (error) {
            console.error(`Error getting details for project ${project.name}:`, error);
            return {
              id: project.id,
              name: project.name,
              description: project.description || '',
              processTemplate: 'Unknown',
              sourceControl: 'Git',
              visibility: project.visibility || 'Private',
              createdDate: new Date(project.lastUpdateTime || Date.now()),
              workItemCount: 0,
              repoCount: 0,
              testCaseCount: 0,
              pipelineCount: 0
            };
          }
        })
      );
      
      return projectsWithDetails;
    } catch (error) {
      console.error('Error fetching projects:', error);
      throw error;
    }
  }

  async getProjectDetails(projectId: string) {
    return this.makeRequest(`_apis/projects/${projectId}?includeCapabilities=true&includeHistory=true&api-version=7.0`);
  }

  async getWorkItems(projectName: string) {
    try {
      // Get all work items using WIQL
      const wiqlQuery = {
        query: `SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], [System.AssignedTo], [System.CreatedDate] FROM WorkItems WHERE [System.TeamProject] = '${projectName}' ORDER BY [System.Id]`
      };
      
      const wiqlResponse = await fetch(`https://dev.azure.com/${this.organization}/${projectName}/_apis/wit/wiql?api-version=7.0`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(wiqlQuery)
      });
      
      const wiqlResult = await wiqlResponse.json();
      const workItemIds = wiqlResult.workItems?.map((wi: any) => wi.id) || [];
      
      if (workItemIds.length === 0) return [];
      
      // Get detailed work item data
      const workItemsResponse = await this.makeRequest(`${projectName}/_apis/wit/workitems?ids=${workItemIds.slice(0, 200).join(',')}&$expand=all&api-version=7.0`);
      return workItemsResponse.value || [];
    } catch (error) {
      console.error('Error fetching work items:', error);
      return [];
    }
  }

  async getRepositories(projectName: string) {
    return this.makeRequest(`${projectName}/_apis/git/repositories?api-version=7.0`);
  }

  async getPipelines(projectName: string) {
    return this.makeRequest(`${projectName}/_apis/pipelines?api-version=7.0`);
  }

  async getTestPlans(projectName: string) {
    return this.makeRequest(`${projectName}/_apis/test/plans?api-version=7.0`);
  }

  async getBoards(projectName: string) {
    return this.makeRequest(`${projectName}/_apis/work/boards?api-version=7.0`);
  }

  async getQueries(projectName: string) {
    return this.makeRequest(`${projectName}/_apis/wit/queries?$depth=2&api-version=7.0`);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Start Python FastAPI backend
  const { spawn } = await import('child_process');
  
  console.log('Starting Python FastAPI backend on port 8000...');
  const pythonProcess = spawn('python', ['-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8000'], {
    cwd: './backend',
    stdio: 'pipe'
  });
  
  pythonProcess.stdout?.on('data', (data: Buffer) => {
    console.log(`[python] ${data.toString().trim()}`);
  });
  
  pythonProcess.stderr?.on('data', (data: Buffer) => {
    console.log(`[python error] ${data.toString().trim()}`);
  });
  
  // Wait for Python backend to start
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Proxy ADO Connections to Python backend
  app.get("/api/connections", async (req, res) => {
    try {
      const response = await fetch("http://localhost:8000/api/connections");
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch connections" });
    }
  });

  app.post("/api/connections", async (req, res) => {
    try {
      const response = await fetch("http://localhost:8000/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body)
      });
      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json(data);
      }
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Failed to create connection" });
    }
  });

  app.post("/api/connections/test", async (req, res) => {
    try {
      const response = await fetch("http://localhost:8000/api/connections/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body)
      });
      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json(data);
      }
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Failed to test connection" });
    }
  });

  // Proxy Projects to Python backend
  app.get("/api/projects", async (req, res) => {
    try {
      const response = await fetch("http://localhost:8000/api/projects");
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.post("/api/projects/sync", async (req, res) => {
    try {
      const response = await fetch("http://localhost:8000/api/projects/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body)
      });
      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json(data);
      }
      res.json(data);
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

  // Project Details with comprehensive extraction
  app.get("/api/projects/:id/details", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const project = await storage.getProject(projectId);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const connection = await storage.getAdoConnection(project.connectionId!);
      if (!connection) {
        return res.status(404).json({ message: "Connection not found" });
      }

      const client = new AzureDevOpsClient(connection.baseUrl, connection.patToken);
      
      // Extract comprehensive project data
      const [
        projectDetails,
        workItems,
        repositories,
        pipelines,
        testPlans,
        boards,
        queries
      ] = await Promise.all([
        client.getProjectDetails(project.externalId),
        client.getWorkItems(project.name),
        client.getRepositories(project.name),
        client.getPipelines(project.name),
        client.getTestPlans(project.name),
        client.getBoards(project.name),
        client.getQueries(project.name)
      ]);

      res.json({
        project: projectDetails,
        workItems: workItems,
        repositories: repositories,
        pipelines: pipelines,
        testPlans: testPlans,
        boards: boards,
        queries: queries
      });
    } catch (error) {
      console.error('Error fetching project details:', error);
      res.status(500).json({ message: "Failed to fetch project details" });
    }
  });

  // Work Items with detailed extraction
  app.get("/api/projects/:id/workitems", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const project = await storage.getProject(projectId);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const connection = await storage.getAdoConnection(project.connectionId!);
      if (!connection) {
        return res.status(404).json({ message: "Connection not found" });
      }

      const client = new AzureDevOpsClient(connection.baseUrl, connection.patToken);
      const workItems = await client.getWorkItems(project.name);
      
      res.json(workItems);
    } catch (error) {
      console.error('Error fetching work items:', error);
      res.status(500).json({ message: "Failed to fetch work items" });
    }
  });

  // Repositories with files, commits, PRs
  app.get("/api/projects/:id/repositories", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const project = await storage.getProject(projectId);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const connection = await storage.getAdoConnection(project.connectionId!);
      if (!connection) {
        return res.status(404).json({ message: "Connection not found" });
      }

      const client = new AzureDevOpsClient(connection.baseUrl, connection.patToken);
      const repositories = await client.getRepositories(project.name);
      
      res.json(repositories);
    } catch (error) {
      console.error('Error fetching repositories:', error);
      res.status(500).json({ message: "Failed to fetch repositories" });
    }
  });

  // Boards with columns
  app.get("/api/projects/:id/boards", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const project = await storage.getProject(projectId);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const connection = await storage.getAdoConnection(project.connectionId!);
      if (!connection) {
        return res.status(404).json({ message: "Connection not found" });
      }

      const client = new AzureDevOpsClient(connection.baseUrl, connection.patToken);
      const boards = await client.getBoards(project.name);
      
      res.json(boards);
    } catch (error) {
      console.error('Error fetching boards:', error);
      res.status(500).json({ message: "Failed to fetch boards" });
    }
  });

  // Test Plans with configurations, runs, test results
  app.get("/api/projects/:id/testplans", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const project = await storage.getProject(projectId);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const connection = await storage.getAdoConnection(project.connectionId!);
      if (!connection) {
        return res.status(404).json({ message: "Connection not found" });
      }

      const client = new AzureDevOpsClient(connection.baseUrl, connection.patToken);
      const testPlans = await client.getTestPlans(project.name);
      
      res.json(testPlans);
    } catch (error) {
      console.error('Error fetching test plans:', error);
      res.status(500).json({ message: "Failed to fetch test plans" });
    }
  });

  // Queries
  app.get("/api/projects/:id/queries", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const project = await storage.getProject(projectId);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const connection = await storage.getAdoConnection(project.connectionId!);
      if (!connection) {
        return res.status(404).json({ message: "Connection not found" });
      }

      const client = new AzureDevOpsClient(connection.baseUrl, connection.patToken);
      const queries = await client.getQueries(project.name);
      
      res.json(queries);
    } catch (error) {
      console.error('Error fetching queries:', error);
      res.status(500).json({ message: "Failed to fetch queries" });
    }
  });

  // Proxy Statistics to Python backend
  app.get("/api/statistics", async (req, res) => {
    try {
      const response = await fetch("http://localhost:8000/api/statistics");
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
