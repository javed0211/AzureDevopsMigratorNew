import { Pool } from 'pg';
import { 
  users, 
  adoConnections, 
  projects, 
  migrationJobs, 
  auditLogs,
  type User, 
  type InsertUser,
  type AdoConnection,
  type InsertAdoConnection,
  type Project,
  type InsertProject,
  type MigrationJob,
  type InsertMigrationJob,
  type AuditLog,
  type InsertAuditLog
} from "@shared/schema";

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // ADO Connections
  getAdoConnections(): Promise<AdoConnection[]>;
  getAdoConnection(id: number): Promise<AdoConnection | undefined>;
  createAdoConnection(connection: InsertAdoConnection): Promise<AdoConnection>;
  updateAdoConnection(id: number, connection: Partial<AdoConnection>): Promise<AdoConnection | undefined>;
  deleteAdoConnection(id: number): Promise<boolean>;

  // Projects
  getProjects(connectionId?: number): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<Project>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<boolean>;
  updateProjectStatus(id: number, status: string): Promise<Project | undefined>;

  // Migration Jobs
  getMigrationJobs(): Promise<MigrationJob[]>;
  getMigrationJob(id: number): Promise<MigrationJob | undefined>;
  createMigrationJob(job: InsertMigrationJob): Promise<MigrationJob>;
  updateMigrationJob(id: number, job: Partial<MigrationJob>): Promise<MigrationJob | undefined>;

  // Audit Logs
  getAuditLogs(jobId?: number): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private adoConnections: Map<number, AdoConnection>;
  private projects: Map<number, Project>;
  private migrationJobs: Map<number, MigrationJob>;
  private auditLogs: Map<number, AuditLog>;
  private currentUserId: number;
  private currentConnectionId: number;
  private currentProjectId: number;
  private currentJobId: number;
  private currentLogId: number;

  constructor() {
    this.users = new Map();
    this.adoConnections = new Map();
    this.projects = new Map();
    this.migrationJobs = new Map();
    this.auditLogs = new Map();
    this.currentUserId = 1;
    this.currentConnectionId = 1;
    this.currentProjectId = 1;
    this.currentJobId = 1;
    this.currentLogId = 1;

    // Initialize with default connection
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    const defaultConnection: AdoConnection = {
      id: this.currentConnectionId++,
      name: "DevCGAzureDevOps Organization",
      organization: "DevCGAzureDevOps",
      baseUrl: "https://dev.azure.com/DevCGAzureDevOps",
      patToken: "3EKclZegPyeFeU74lJNyCJno6JQwebr1akrodgDxMe7X1YebyV86JQQJ99BFACAAAAAoySsEAAASAZDO88oj",
      isActive: true,
      createdAt: new Date(),
    };
    this.adoConnections.set(defaultConnection.id, defaultConnection);
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // ADO Connections
  async getAdoConnections(): Promise<AdoConnection[]> {
    return Array.from(this.adoConnections.values());
  }

  async getAdoConnection(id: number): Promise<AdoConnection | undefined> {
    return this.adoConnections.get(id);
  }

  async createAdoConnection(connection: InsertAdoConnection): Promise<AdoConnection> {
    const id = this.currentConnectionId++;
    const newConnection: AdoConnection = {
      ...connection,
      id,
      isActive: connection.isActive ?? false,
      createdAt: new Date(),
    };
    this.adoConnections.set(id, newConnection);
    return newConnection;
  }

  async updateAdoConnection(id: number, connection: Partial<AdoConnection>): Promise<AdoConnection | undefined> {
    const existing = this.adoConnections.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...connection };
    this.adoConnections.set(id, updated);
    return updated;
  }

  async deleteAdoConnection(id: number): Promise<boolean> {
    return this.adoConnections.delete(id);
  }

  // Projects
  async getProjects(connectionId?: number): Promise<Project[]> {
    const projects = Array.from(this.projects.values());
    return connectionId 
      ? projects.filter(p => p.connectionId === connectionId)
      : projects;
  }

  async getProject(id: number): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async createProject(project: InsertProject): Promise<Project> {
    const id = this.currentProjectId++;
    const newProject: Project = { 
      ...project, 
      id,
      status: project.status ?? "ready",
      description: project.description ?? null,
      createdDate: project.createdDate ?? null,
      connectionId: project.connectionId ?? null,
      workItemCount: project.workItemCount ?? 0,
      repoCount: project.repoCount ?? 0,
      testCaseCount: project.testCaseCount ?? 0,
      pipelineCount: project.pipelineCount ?? 0,
    };
    this.projects.set(id, newProject);
    return newProject;
  }

  async updateProject(id: number, project: Partial<Project>): Promise<Project | undefined> {
    const existing = this.projects.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...project };
    this.projects.set(id, updated);
    return updated;
  }

  async deleteProject(id: number): Promise<boolean> {
    return this.projects.delete(id);
  }

  async updateProjectStatus(id: number, status: string): Promise<Project | undefined> {
    return this.updateProject(id, { status });
  }

  // Migration Jobs
  async getMigrationJobs(): Promise<MigrationJob[]> {
    return Array.from(this.migrationJobs.values());
  }

  async getMigrationJob(id: number): Promise<MigrationJob | undefined> {
    return this.migrationJobs.get(id);
  }

  async createMigrationJob(job: InsertMigrationJob): Promise<MigrationJob> {
    const id = this.currentJobId++;
    const newJob: MigrationJob = {
      ...job,
      id,
      status: job.status ?? "pending",
      progress: job.progress ?? 0,
      projectId: job.projectId ?? null,
      sourceConnectionId: job.sourceConnectionId ?? null,
      targetConnectionId: job.targetConnectionId ?? null,
      errorMessage: job.errorMessage ?? null,
      startedAt: null,
      completedAt: null,
    };
    this.migrationJobs.set(id, newJob);
    return newJob;
  }

  async updateMigrationJob(id: number, job: Partial<MigrationJob>): Promise<MigrationJob | undefined> {
    const existing = this.migrationJobs.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...job };
    this.migrationJobs.set(id, updated);
    return updated;
  }

  // Audit Logs
  async getAuditLogs(jobId?: number): Promise<AuditLog[]> {
    const logs = Array.from(this.auditLogs.values());
    return jobId 
      ? logs.filter(l => l.jobId === jobId)
      : logs;
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const id = this.currentLogId++;
    const newLog: AuditLog = {
      ...log,
      id,
      jobId: log.jobId ?? null,
      details: log.details ?? null,
      timestamp: new Date(),
    };
    this.auditLogs.set(id, newLog);
    return newLog;
  }
}

export class DatabaseStorage implements IStorage {
  // Projects - Enhanced to use PostgreSQL backend
  async getProjects(connectionId?: number): Promise<Project[]> {
    const client = await pool.connect();
    try {
      let query = `
        SELECT id, external_id as "externalId", name, description, 
               process_template as "processTemplate", source_control as "sourceControl",
               visibility, status, created_date as "createdDate",
               work_item_count as "workItemCount", repo_count as "repoCount", 
               test_case_count as "testCaseCount", pipeline_count as "pipelineCount",
               connection_id as "connectionId"
        FROM projects
      `;
      const params: any[] = [];
      
      if (connectionId) {
        query += ' WHERE connection_id = $1';
        params.push(connectionId);
      }
      
      query += ' ORDER BY name';
      
      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getProject(id: number): Promise<Project | undefined> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT id, external_id as "externalId", name, description, 
               process_template as "processTemplate", source_control as "sourceControl",
               visibility, status, created_date as "createdDate",
               work_item_count as "workItemCount", repo_count as "repoCount", 
               test_case_count as "testCaseCount", pipeline_count as "pipelineCount",
               connection_id as "connectionId"
        FROM projects WHERE id = $1
      `, [id]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async createProject(project: InsertProject): Promise<Project> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO projects (external_id, name, description, process_template, 
                            source_control, visibility, status, created_date,
                            work_item_count, repo_count, test_case_count, 
                            pipeline_count, connection_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id, external_id as "externalId", name, description, 
                  process_template as "processTemplate", source_control as "sourceControl",
                  visibility, status, created_date as "createdDate",
                  work_item_count as "workItemCount", repo_count as "repoCount", 
                  test_case_count as "testCaseCount", pipeline_count as "pipelineCount",
                  connection_id as "connectionId"
      `, [
        project.externalId, project.name, project.description, project.processTemplate,
        project.sourceControl, project.visibility, project.status || "ready", 
        project.createdDate, project.workItemCount || 0, project.repoCount || 0,
        project.testCaseCount || 0, project.pipelineCount || 0, project.connectionId
      ]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async updateProject(id: number, project: Partial<Project>): Promise<Project | undefined> {
    const client = await pool.connect();
    try {
      const setParts = [];
      const values = [];
      let paramIndex = 1;

      Object.entries(project).forEach(([key, value]) => {
        if (value !== undefined) {
          const dbKey = key === 'externalId' ? 'external_id' :
                       key === 'processTemplate' ? 'process_template' :
                       key === 'sourceControl' ? 'source_control' :
                       key === 'createdDate' ? 'created_date' :
                       key === 'workItemCount' ? 'work_item_count' :
                       key === 'repoCount' ? 'repo_count' :
                       key === 'testCaseCount' ? 'test_case_count' :
                       key === 'pipelineCount' ? 'pipeline_count' :
                       key === 'connectionId' ? 'connection_id' : key;
          setParts.push(`${dbKey} = $${paramIndex++}`);
          values.push(value);
        }
      });

      if (setParts.length === 0) return this.getProject(id);

      values.push(id);
      const result = await client.query(`
        UPDATE projects 
        SET ${setParts.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, external_id as "externalId", name, description, 
                  process_template as "processTemplate", source_control as "sourceControl",
                  visibility, status, created_date as "createdDate",
                  work_item_count as "workItemCount", repo_count as "repoCount", 
                  test_case_count as "testCaseCount", pipeline_count as "pipelineCount",
                  connection_id as "connectionId"
      `, values);
      
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async deleteProject(id: number): Promise<boolean> {
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM projects WHERE id = $1', [id]);
      return result.rowCount > 0;
    } finally {
      client.release();
    }
  }

  async updateProjectStatus(id: number, status: string): Promise<Project | undefined> {
    return this.updateProject(id, { status });
  }

  // ADO Connections - Enhanced PostgreSQL backend
  async getAdoConnections(): Promise<AdoConnection[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT id, name, organization, base_url as "baseUrl", 
               is_active as "isActive", created_at as "createdAt"
        FROM ado_connections 
        WHERE is_active = true
        ORDER BY created_at DESC
      `);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getAdoConnection(id: number): Promise<AdoConnection | undefined> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT id, name, organization, base_url as "baseUrl", 
               is_active as "isActive", created_at as "createdAt"
        FROM ado_connections WHERE id = $1
      `, [id]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async createAdoConnection(connection: InsertAdoConnection): Promise<AdoConnection> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO ado_connections (name, organization, base_url, pat_token, is_active, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id, name, organization, base_url as "baseUrl", 
                  is_active as "isActive", created_at as "createdAt"
      `, [
        connection.name, 
        connection.organization, 
        connection.baseUrl, 
        connection.patToken, 
        connection.isActive ?? true
      ]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async updateAdoConnection(id: number, connection: Partial<AdoConnection>): Promise<AdoConnection | undefined> {
    const client = await pool.connect();
    try {
      const setParts = [];
      const values = [];
      let paramIndex = 1;

      Object.entries(connection).forEach(([key, value]) => {
        if (value !== undefined) {
          const dbKey = key === 'baseUrl' ? 'base_url' :
                       key === 'patToken' ? 'pat_token' :
                       key === 'isActive' ? 'is_active' :
                       key === 'createdAt' ? 'created_at' : key;
          setParts.push(`${dbKey} = $${paramIndex++}`);
          values.push(value);
        }
      });

      if (setParts.length === 0) return this.getAdoConnection(id);

      values.push(id);
      const result = await client.query(`
        UPDATE ado_connections 
        SET ${setParts.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, name, organization, base_url as "baseUrl", 
                  is_active as "isActive", created_at as "createdAt"
      `, values);
      
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async deleteAdoConnection(id: number): Promise<boolean> {
    const client = await pool.connect();
    try {
      const result = await client.query('UPDATE ado_connections SET is_active = false WHERE id = $1', [id]);
      return result.rowCount > 0;
    } finally {
      client.release();
    }
  }

  // Migration Jobs - Mapped to extraction_jobs table
  async getMigrationJobs(): Promise<MigrationJob[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT id, project_id as "projectId", artifact_type as "type", 
               status, started_at as "startedAt", completed_at as "completedAt",
               error_message as "errorMessage", progress,
               1 as "sourceConnectionId", 1 as "targetConnectionId"
        FROM extraction_jobs 
        ORDER BY started_at DESC
      `);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getMigrationJob(id: number): Promise<MigrationJob | undefined> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT id, project_id as "projectId", artifact_type as "type", 
               status, started_at as "startedAt", completed_at as "completedAt",
               error_message as "errorMessage", progress,
               1 as "sourceConnectionId", 1 as "targetConnectionId"
        FROM extraction_jobs WHERE id = $1
      `, [id]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async createMigrationJob(job: InsertMigrationJob): Promise<MigrationJob> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO extraction_jobs (project_id, artifact_type, status, started_at, progress)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, project_id as "projectId", artifact_type as "type", 
                  status, started_at as "startedAt", completed_at as "completedAt",
                  error_message as "errorMessage", progress,
                  1 as "sourceConnectionId", 1 as "targetConnectionId"
      `, [
        job.projectId,
        job.type || 'migration',
        job.status || 'pending',
        job.startedAt,
        job.progress || 0
      ]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async updateMigrationJob(id: number, job: Partial<MigrationJob>): Promise<MigrationJob | undefined> {
    const client = await pool.connect();
    try {
      const setParts = [];
      const values = [];
      let paramIndex = 1;

      Object.entries(job).forEach(([key, value]) => {
        if (value !== undefined && key !== 'sourceConnectionId' && key !== 'targetConnectionId') {
          const dbKey = key === 'projectId' ? 'project_id' :
                       key === 'type' ? 'artifact_type' :
                       key === 'startedAt' ? 'started_at' :
                       key === 'completedAt' ? 'completed_at' :
                       key === 'errorMessage' ? 'error_message' : key;
          setParts.push(`${dbKey} = $${paramIndex++}`);
          values.push(value);
        }
      });

      if (setParts.length === 0) return this.getMigrationJob(id);

      values.push(id);
      const result = await client.query(`
        UPDATE extraction_jobs 
        SET ${setParts.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, project_id as "projectId", artifact_type as "type", 
                  status, started_at as "startedAt", completed_at as "completedAt",
                  error_message as "errorMessage", progress,
                  1 as "sourceConnectionId", 1 as "targetConnectionId"
      `, values);
      
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Audit Logs - Mapped to extraction_logs table
  async getAuditLogs(jobId?: number): Promise<AuditLog[]> {
    const client = await pool.connect();
    try {
      let query = `
        SELECT id, job_id as "jobId", level, message, details, timestamp
        FROM extraction_logs
      `;
      const params: any[] = [];
      
      if (jobId) {
        query += ' WHERE job_id = $1';
        params.push(jobId);
      }
      
      query += ' ORDER BY timestamp DESC';
      
      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO extraction_logs (job_id, level, message, details, timestamp)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING id, job_id as "jobId", level, message, details, timestamp
      `, [
        log.jobId,
        log.level || 'INFO',
        log.message,
        log.details || {}
      ]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Legacy User methods - maintained for compatibility
  async getUser(id: number): Promise<User | undefined> {
    return undefined; // Not implemented in current schema
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return undefined; // Not implemented in current schema
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    throw new Error('User management not implemented in database storage');
  }
}

// Use PostgreSQL-backed storage
export const storage = new DatabaseStorage();
