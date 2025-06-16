import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Database, CheckCircle, Clock, AlertCircle, RefreshCw, Code } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { ExtractionJob, Project } from "./types";

interface OverviewTabProps {
  projects: Project[];
  jobs: ExtractionJob[];
  isLoading: boolean;
  showAllJobs: boolean;
  setShowAllJobs: (show: boolean) => void;
  expandedProjects: Record<string, boolean>;
  toggleProjectExpansion: (projectId: number) => void;
}

export const OverviewTab = ({
  projects,
  jobs,
  isLoading,
  showAllJobs,
  setShowAllJobs,
  expandedProjects,
  toggleProjectExpansion
}: OverviewTabProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Group jobs by project
  const jobsByProject = jobs.reduce((acc: Record<number, ExtractionJob[]>, job: ExtractionJob) => {
    if (!acc[job.projectId]) {
      acc[job.projectId] = [];
    }
    acc[job.projectId].push(job);
    return acc;
  }, {});

  // Start extraction mutation
  const startExtractionMutation = useMutation({
    mutationFn: (params: { projectId: number, artifactType: string }) => 
      api.extraction.startJob(params.projectId, params.artifactType),
    onSuccess: () => {
      toast({
        title: "Extraction started",
        description: "The extraction process has been started successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/extraction/jobs'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error starting extraction",
        description: error.message || "Failed to start extraction process.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Database className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading projects...</span>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-68">
          <Code className="h-12 w-12 text-gray-400 mb-8" />
          <h3 className="text-xl font-medium mb-2">No Projects Selected</h3>
          <p className="text-gray-500 text-center max-w-md">
            You haven't selected any projects for extraction yet. Go to the Project Selection page to choose projects.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Selected Projects */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Selected Projects</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {projects.map((project) => (
              <Card key={project.id} className="overflow-hidden w-full" style={{ width: '100%' }}>
                <CardHeader 
                  className="bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors w-full"
                  onClick={() => toggleProjectExpansion(project.id)}
                >
                  <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center">
                      <Database className="h-5 w-5 mr-2 text-blue-600" />
                      {project.name}
                      <div className="ml-3">
                        {expandedProjects[project.id] ? (
                          <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </div>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="ml-2">ID: {project.id}</Badge>
                      {jobsByProject[project.id]?.some(job => job.status === 'in_progress') && (
                        <Badge className="bg-blue-100 text-blue-800">
                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                          Extraction in progress
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                {expandedProjects[project.id] && (
                  <CardContent className="pt-4">
                    <div className="space-y-4">
                      {/* Extraction Summary */}
                      <div className="p-4 bg-gray-50 rounded-md">
                        <h3 className="text-sm font-medium mb-3">Extraction Summary</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {/* Project Metadata */}
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500 font-medium">Project Metadata</span>
                            <div className="mt-2 space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-xs">Area Paths</span>
                                <Badge className={
                                  project.areaPaths?.extracted ? 'bg-green-100 text-green-800' : 
                                  project.areaPaths?.error ? 'bg-red-100 text-red-800' : 
                                  'bg-gray-100 text-gray-800'
                                }>
                                  {project.areaPaths?.extracted ? `${project.areaPaths.count}` : 
                                   project.areaPaths?.error ? 'Failed' : 'Not extracted'}
                                </Badge>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs">Iteration Paths</span>
                                <Badge className={
                                  project.iterationPaths?.extracted ? 'bg-green-100 text-green-800' : 
                                  project.iterationPaths?.error ? 'bg-red-100 text-red-800' : 
                                  'bg-gray-100 text-gray-800'
                                }>
                                  {project.iterationPaths?.extracted ? `${project.iterationPaths.count}` : 
                                   project.iterationPaths?.error ? 'Failed' : 'Not extracted'}
                                </Badge>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs">Work Item Types</span>
                                <Badge className={
                                  project.workItemTypes?.extracted ? 'bg-green-100 text-green-800' : 
                                  project.workItemTypes?.error ? 'bg-red-100 text-red-800' : 
                                  'bg-gray-100 text-gray-800'
                                }>
                                  {project.workItemTypes?.extracted ? `${project.workItemTypes.count}` : 
                                   project.workItemTypes?.error ? 'Failed' : 'Not extracted'}
                                </Badge>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs">Custom Fields</span>
                                <Badge className={
                                  project.customFields?.extracted ? 'bg-green-100 text-green-800' : 
                                  project.customFields?.error ? 'bg-red-100 text-red-800' : 
                                  'bg-gray-100 text-gray-800'
                                }>
                                  {project.customFields?.extracted ? `${project.customFields.count}` : 
                                   project.customFields?.error ? 'Failed' : 'Not extracted'}
                                </Badge>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs">Board Columns</span>
                                <Badge className={
                                  project.boardColumns?.extracted ? 'bg-green-100 text-green-800' : 
                                  project.boardColumns?.error ? 'bg-red-100 text-red-800' : 
                                  'bg-gray-100 text-gray-800'
                                }>
                                  {project.boardColumns?.extracted ? `${project.boardColumns.count}` : 
                                   project.boardColumns?.error ? 'Failed' : 'Not extracted'}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          
                          {/* Work Items */}
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500 font-medium">Work Items</span>
                            <div className="mt-2 space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-xs">Total Work Items</span>
                                <Badge className={
                                  project.workItems?.extracted ? 'bg-green-100 text-green-800' : 
                                  project.workItems?.error ? 'bg-red-100 text-red-800' : 
                                  'bg-gray-100 text-gray-800'
                                }>
                                  {project.workItems?.extracted ? `${project.workItems.count}` : 
                                   project.workItems?.error ? 'Failed' : 'Not extracted'}
                                </Badge>
                              </div>
                              {project.workItems?.extracted && project.workItems.items && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {project.workItems.items.slice(0, 3).map((item: any, index: number) => (
                                    <div key={index} className="flex justify-between items-center mt-1">
                                      <span>{item.name || item.type}</span>
                                      <span>{item.count}</span>
                                    </div>
                                  ))}
                                  {project.workItems.items.length > 3 && (
                                    <div className="text-xs text-blue-600 mt-1">
                                      +{project.workItems.items.length - 3} more types
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Repositories */}
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500 font-medium">Repositories</span>
                            <div className="mt-2 space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-xs">Git Repositories</span>
                                <Badge className={
                                  project.repositories?.extracted ? 'bg-green-100 text-green-800' : 
                                  project.repositories?.error ? 'bg-red-100 text-red-800' : 
                                  'bg-gray-100 text-gray-800'
                                }>
                                  {project.repositories?.extracted ? `${project.repositories.count}` : 
                                   project.repositories?.error ? 'Failed' : 'Not extracted'}
                                </Badge>
                              </div>
                              {project.repositories?.extracted && project.repositories.items && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {project.repositories.items.slice(0, 3).map((repo: any, index: number) => (
                                    <div key={index} className="flex justify-between items-center mt-1">
                                      <span className="truncate max-w-[120px]">{repo.name}</span>
                                      <span>{repo.size ? `${Math.round(repo.size / 1024 / 1024)} MB` : ''}</span>
                                    </div>
                                  ))}
                                  {project.repositories.items.length > 3 && (
                                    <div className="text-xs text-blue-600 mt-1">
                                      +{project.repositories.items.length - 3} more repos
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Test Management & Pipelines */}
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500 font-medium">Test & Pipelines</span>
                            <div className="mt-2 space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-xs">Test Cases</span>
                                <Badge className={
                                  project.testCases?.extracted ? 'bg-green-100 text-green-800' : 
                                  project.testCases?.error ? 'bg-red-100 text-red-800' : 
                                  'bg-gray-100 text-gray-800'
                                }>
                                  {project.testCases?.extracted ? `${project.testCases.count}` : 
                                   project.testCases?.error ? 'Failed' : 'Not extracted'}
                                </Badge>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs">Test Suites</span>
                                <Badge className={
                                  project.testSuites?.extracted ? 'bg-green-100 text-green-800' : 
                                  project.testSuites?.error ? 'bg-red-100 text-red-800' : 
                                  'bg-gray-100 text-gray-800'
                                }>
                                  {project.testSuites?.extracted ? `${project.testSuites.count}` : 
                                   project.testSuites?.error ? 'Failed' : 'Not extracted'}
                                </Badge>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs">Build Pipelines</span>
                                <Badge className={
                                  project.buildPipelines?.extracted ? 'bg-green-100 text-green-800' : 
                                  project.buildPipelines?.error ? 'bg-red-100 text-red-800' : 
                                  'bg-gray-100 text-gray-800'
                                }>
                                  {project.buildPipelines?.extracted ? `${project.buildPipelines.count}` : 
                                   project.buildPipelines?.error ? 'Failed' : 'Not extracted'}
                                </Badge>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs">Release Pipelines</span>
                                <Badge className={
                                  project.releasePipelines?.extracted ? 'bg-green-100 text-green-800' : 
                                  project.releasePipelines?.error ? 'bg-red-100 text-red-800' : 
                                  'bg-gray-100 text-gray-800'
                                }>
                                  {project.releasePipelines?.extracted ? `${project.releasePipelines.count}` : 
                                   project.releasePipelines?.error ? 'Failed' : 'Not extracted'}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Recent Extraction Jobs */}
                      {jobsByProject[project.id] && jobsByProject[project.id].length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium mb-2">Recent Extraction Jobs</h3>
                          <div className="border rounded-md overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-gray-50 text-left">
                                  <th className="px-4 py-2">Type</th>
                                  <th className="px-4 py-2">Status</th>
                                  <th className="px-4 py-2">Progress</th>
                                  <th className="px-4 py-2">Items</th>
                                  <th className="px-4 py-2">Started</th>
                                  <th className="px-4 py-2">Completed</th>
                                </tr>
                              </thead>
                              <tbody>
                                {jobsByProject[project.id]
                                  .slice(0, expandedProjects[project.id] && showAllJobs ? undefined : 3)
                                  .map((job) => (
                                    <tr key={job.id} className="border-t">
                                      <td className="px-4 py-3">
                                        <span className="capitalize">{job.artifactType}</span>
                                      </td>
                                      <td className="px-4 py-3">
                                        <Badge className={
                                          job.status === 'completed' ? 'bg-green-100 text-green-800' :
                                          job.status === 'failed' ? 'bg-red-100 text-red-800' :
                                          job.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                          'bg-gray-100 text-gray-800'
                                        }>
                                          <span className="flex items-center">
                                            {job.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                                            {job.status === 'failed' && <AlertCircle className="h-3 w-3 mr-1" />}
                                            {job.status === 'in_progress' && <RefreshCw className="h-3 w-3 mr-1 animate-spin" />}
                                            {job.status === 'queued' && <Clock className="h-3 w-3 mr-1" />}
                                            {job.status}
                                          </span>
                                        </Badge>
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                          <Progress 
                                            value={job.progress || 0} 
                                            className={`h-2 w-24 ${job.status === 'completed' ? 'bg-green-100' : ''}`} 
                                          />
                                          <span className="text-xs">{job.progress || 0}%</span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-xs">
                                        {job.extractedItems || 0} / {job.totalItems || 0}
                                      </td>
                                      <td className="px-4 py-3 text-xs">
                                        {job.startedAt ? new Date(job.startedAt).toLocaleString() : '-'}
                                      </td>
                                      <td className="px-4 py-3 text-xs">
                                        {job.completedAt ? new Date(job.completedAt).toLocaleString() : '-'}
                                      </td>
                                    </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          
                          {jobsByProject[project.id].length > 3 && !showAllJobs && (
                            <div className="mt-2 text-center">
                              <Button 
                                variant="link" 
                                className="text-xs"
                                onClick={() => setShowAllJobs(true)}
                              >
                                Show all {jobsByProject[project.id].length} jobs
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
};