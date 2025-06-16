import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Database, TestTube, RefreshCw, Beaker } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Project } from "./types";

interface TestManagementTabProps {
  projects: Project[];
  isLoading: boolean;
}

export const TestManagementTab = ({ projects, isLoading }: TestManagementTabProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});

  // Start extraction mutation
  const startExtractionMutation = useMutation({
    mutationFn: (params: { projectId: number, artifactType: string }) => 
      api.extraction.startJob(params.projectId, params.artifactType),
    onSuccess: () => {
      toast({
        title: "Extraction started",
        description: "The test management extraction process has been started successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/extraction/jobs'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error starting extraction",
        description: error.message || "Failed to start test management extraction process.",
        variant: "destructive",
      });
    },
  });

  // Toggle project expansion
  const toggleProjectExpansion = (projectId: number) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
  };

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
        <CardContent className="flex flex-col items-center justify-center h-64">
          <TestTube className="h-12 w-12 text-gray-400 mb-4" />
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
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Test Management Extraction</h2>
        <Button 
          variant="outline" 
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/projects/selected'] });
            toast({
              title: "Refreshing Data",
              description: "Fetching the latest test management data...",
            });
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Data
        </Button>
      </div>

      <div className="space-y-6">
        {projects.map((project) => (
          <Card key={project.id} className="w-full" style={{ width: '100%' }}>
            <CardHeader 
              className="bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors w-full"
              onClick={() => toggleProjectExpansion(project.id)}
            >
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center">
                  <TestTube className="h-5 w-5 mr-2 text-blue-600" />
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
                  {(project.testCases?.extracted || project.testSuites?.extracted) && (
                    <Badge className="bg-green-100 text-green-800">
                      Test Data Extracted
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            
            {expandedProjects[project.id] && (
              <CardContent className="pt-4">
                <div className="space-y-6">
                  {/* Test Management Options */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Test Cases */}
                    <div className="p-4 bg-gray-50 rounded-md">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-medium">Test Cases</h3>
                        <Badge className={
                          project.testCases?.extracted ? 'bg-green-100 text-green-800' : 
                          project.testCases?.error ? 'bg-red-100 text-red-800' : 
                          'bg-gray-100 text-gray-800'
                        }>
                          {project.testCases?.extracted ? `${project.testCases.count} extracted` : 
                           project.testCases?.error ? 'Failed' : 'Not extracted'}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-500 mb-3">
                        Extract test cases including steps, expected results, and other test-specific data.
                      </div>
                      <Button 
                        size="sm"
                        onClick={() => startExtractionMutation.mutate({ projectId: project.id, artifactType: "testcases" })}
                        disabled={startExtractionMutation.isPending && startExtractionMutation.variables?.projectId === project.id}
                      >
                        {startExtractionMutation.isPending && startExtractionMutation.variables?.projectId === project.id && startExtractionMutation.variables?.artifactType === "testcases" ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Extracting...
                          </>
                        ) : (
                          "Extract Test Cases"
                        )}
                      </Button>
                    </div>
                    
                    {/* Test Suites */}
                    <div className="p-4 bg-gray-50 rounded-md">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-medium">Test Suites</h3>
                        <Badge className={
                          project.testSuites?.extracted ? 'bg-green-100 text-green-800' : 
                          project.testSuites?.error ? 'bg-red-100 text-red-800' : 
                          'bg-gray-100 text-gray-800'
                        }>
                          {project.testSuites?.extracted ? `${project.testSuites.count} extracted` : 
                           project.testSuites?.error ? 'Failed' : 'Not extracted'}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-500 mb-3">
                        Extract test suites including their structure and test case associations.
                      </div>
                      <Button 
                        size="sm"
                        onClick={() => startExtractionMutation.mutate({ projectId: project.id, artifactType: "testsuites" })}
                        disabled={startExtractionMutation.isPending && startExtractionMutation.variables?.projectId === project.id}
                      >
                        {startExtractionMutation.isPending && startExtractionMutation.variables?.projectId === project.id && startExtractionMutation.variables?.artifactType === "testsuites" ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Extracting...
                          </>
                        ) : (
                          "Extract Test Suites"
                        )}
                      </Button>
                    </div>
                    
                    {/* Test Plans */}
                    <div className="p-4 bg-gray-50 rounded-md">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-medium">Test Plans</h3>
                        <Badge className={
                          project.testPlans?.extracted ? 'bg-green-100 text-green-800' : 
                          project.testPlans?.error ? 'bg-red-100 text-red-800' : 
                          'bg-gray-100 text-gray-800'
                        }>
                          {project.testPlans?.extracted ? `${project.testPlans.count} extracted` : 
                           project.testPlans?.error ? 'Failed' : 'Not extracted'}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-500 mb-3">
                        Extract test plans including configurations and suite associations.
                      </div>
                      <Button 
                        size="sm"
                        onClick={() => startExtractionMutation.mutate({ projectId: project.id, artifactType: "testplans" })}
                        disabled={startExtractionMutation.isPending && startExtractionMutation.variables?.projectId === project.id}
                      >
                        {startExtractionMutation.isPending && startExtractionMutation.variables?.projectId === project.id && startExtractionMutation.variables?.artifactType === "testplans" ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Extracting...
                          </>
                        ) : (
                          "Extract Test Plans"
                        )}
                      </Button>
                    </div>
                    
                    {/* Test Results */}
                    <div className="p-4 bg-gray-50 rounded-md">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-medium">Test Results</h3>
                        <Badge className={
                          project.testResults?.extracted ? 'bg-green-100 text-green-800' : 
                          project.testResults?.error ? 'bg-red-100 text-red-800' : 
                          'bg-gray-100 text-gray-800'
                        }>
                          {project.testResults?.extracted ? `${project.testResults.count} extracted` : 
                           project.testResults?.error ? 'Failed' : 'Not extracted'}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-500 mb-3">
                        Extract test results including run history and outcome details.
                      </div>
                      <Button 
                        size="sm"
                        onClick={() => startExtractionMutation.mutate({ projectId: project.id, artifactType: "testresults" })}
                        disabled={startExtractionMutation.isPending && startExtractionMutation.variables?.projectId === project.id}
                      >
                        {startExtractionMutation.isPending && startExtractionMutation.variables?.projectId === project.id && startExtractionMutation.variables?.artifactType === "testresults" ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Extracting...
                          </>
                        ) : (
                          "Extract Test Results"
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Extraction History */}
                  <div className="p-4 bg-gray-50 rounded-md">
                    <h3 className="text-sm font-medium mb-3">Extraction History</h3>
                    {project.extractionHistory && project.extractionHistory.length > 0 ? (
                      <div className="border rounded-md overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-100 text-left">
                              <th className="px-4 py-2">Type</th>
                              <th className="px-4 py-2">Status</th>
                              <th className="px-4 py-2">Items</th>
                              <th className="px-4 py-2">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {project.extractionHistory
                              .filter(job => ['testcases', 'testsuites', 'testplans', 'testresults'].includes(job.artifactType))
                              .slice(0, 5)
                              .map((job, index) => (
                                <tr key={index} className="border-t">
                                  <td className="px-4 py-2">
                                    {job.artifactType === 'testcases' ? 'Test Cases' :
                                     job.artifactType === 'testsuites' ? 'Test Suites' :
                                     job.artifactType === 'testplans' ? 'Test Plans' : 'Test Results'}
                                  </td>
                                  <td className="px-4 py-2">
                                    <Badge className={
                                      job.status === 'completed' ? 'bg-green-100 text-green-800' :
                                      job.status === 'failed' ? 'bg-red-100 text-red-800' :
                                      'bg-blue-100 text-blue-800'
                                    }>
                                      {job.status}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-2">{job.count || 0}</td>
                                  <td className="px-4 py-2 text-xs">{new Date(job.date).toLocaleString()}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">
                        No extraction history available.
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </>
  );
};