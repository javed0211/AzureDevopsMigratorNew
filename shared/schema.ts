import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const adoConnections = pgTable("ado_connections", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  organization: text("organization").notNull(),
  baseUrl: text("base_url").notNull(),
  patToken: text("pat_token").notNull(),
  isActive: boolean("is_active").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  externalId: text("external_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  processTemplate: text("process_template").notNull(),
  sourceControl: text("source_control").notNull(),
  visibility: text("visibility").notNull(),
  createdDate: timestamp("created_date"),
  status: text("status").notNull().default("ready"), // ready, selected, extracting, extracted, migrating, migrated, error
  connectionId: integer("connection_id").references(() => adoConnections.id),
  workItemCount: integer("work_item_count").default(0),
  repoCount: integer("repo_count").default(0),
  testCaseCount: integer("test_case_count").default(0),
  pipelineCount: integer("pipeline_count").default(0),
});

export const migrationJobs = pgTable("migration_jobs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id),
  sourceConnectionId: integer("source_connection_id").references(() => adoConnections.id),
  targetConnectionId: integer("target_connection_id").references(() => adoConnections.id),
  status: text("status").notNull().default("pending"), // pending, running, completed, failed
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  progress: integer("progress").default(0),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => migrationJobs.id),
  level: text("level").notNull(), // info, warning, error
  message: text("message").notNull(),
  details: text("details"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertAdoConnectionSchema = createInsertSchema(adoConnections).omit({
  id: true,
  createdAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
});

export const insertMigrationJobSchema = createInsertSchema(migrationJobs).omit({
  id: true,
  startedAt: true,
  completedAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type AdoConnection = typeof adoConnections.$inferSelect;
export type InsertAdoConnection = z.infer<typeof insertAdoConnectionSchema>;

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type MigrationJob = typeof migrationJobs.$inferSelect;
export type InsertMigrationJob = z.infer<typeof insertMigrationJobSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
