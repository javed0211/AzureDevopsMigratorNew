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
      name: "Primary Organization",
      organization: "contoso",
      baseUrl: "https://dev.azure.com/contoso",
      patToken: "encrypted_pat_token",
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
    const newProject: Project = { ...project, id };
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
      timestamp: new Date(),
    };
    this.auditLogs.set(id, newLog);
    return newLog;
  }
}

export const storage = new MemStorage();
