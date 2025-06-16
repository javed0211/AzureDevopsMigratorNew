import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Project, ArtifactType } from "./types";

interface MetadataTabProps {
  projects: Project[];
  isLoading: boolean;
  expandedProjects: Record<string, boolean>;
  toggleProjectExpansion: (projectId: number) => void;
}

export const MetadataTab = ({
  projects,
  isLoading,
  expandedProjects,
  toggleProjectExpansion
}: MetadataTabProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Start extraction mutation
  const startExtractionMutation = useMutation({
    mutationFn: (params: { projectId: number, artifactType: ArtifactType }) => 
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
        <span className="ml-2">Loading projects and metadata...</span>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Project Metadata</h2>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={() => {
              // Refresh the selected projects to trigger the useEffect that fetches metadata
              queryClient.invalidateQueries({ queryKey: ['/api/projects/selected'] });
              toast({
                title: "Refreshing Data",
                description: "Fetching the latest project metadata...",
              });
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
        </div>
      </div>
      
      {projects.map((project) => (
        <Card key={project.id} className="mb-6">
          <CardHeader 
            className="bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
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
                {project.areaPaths?.extracted && (
                  <Badge className="bg-green-100 text-green-800">
                    {project.areaPaths.count} Area Paths
                  </Badge>
                )}
                {project.iterationPaths?.extracted && (
                  <Badge className="bg-green-100 text-green-800">
                    {project.iterationPaths.count} Iteration Paths
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          
          {expandedProjects[project.id] && (
            <CardContent className="pt-4">
              <div>
                <Tabs defaultValue="areapaths">
                  <TabsList className="mb-4">
                    <TabsTrigger value="areapaths">Area Paths</TabsTrigger>
                    <TabsTrigger value="iterationpaths">Iteration Paths</TabsTrigger>
                    <TabsTrigger value="workitemtypes">Work Item Types</TabsTrigger>
                    <TabsTrigger value="customfields">Custom Fields</TabsTrigger>
                    <TabsTrigger value="boardcolumns">Board Columns</TabsTrigger>
                    <TabsTrigger value="wikipages">Wiki Pages</TabsTrigger>
                    <TabsTrigger value="history">Extraction History</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="areapaths">
                    {project.areaPaths?.extracted ? (
                      <div className="border rounded-md overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 text-left">
                              <th className="px-4 py-2">Path</th>
                              <th className="px-4 py-2">Level</th>
                              <th className="px-4 py-2">Work Items</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(project.areaPaths?.items || []).slice(0, 5).map((path: any, idx: number) => (
                              <tr key={idx} className="border-t">
                                <td className="px-4 py-2">{path.path}</td>
                                <td className="px-4 py-2">{path.level}</td>
                                <td className="px-4 py-2">{path.workItemCount || 0}</td>
                              </tr>
                            ))}
                            {(!project.areaPaths?.items || project.areaPaths.items.length === 0) && (
                              <tr>
                                <td colSpan={3} className="px-4 py-4 text-center text-gray-500">
                                  No area paths found
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>Area paths have not been extracted yet.</p>
                        <Button 
                          className="mt-4" 
                          onClick={() => startExtractionMutation.mutate({ projectId: project.id, artifactType: "areapaths" })}
                        >
                          Extract Area Paths
                        </Button>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="iterationpaths">
                    {project.iterationPaths?.extracted ? (
                      <div className="border rounded-md overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 text-left">
                              <th className="px-4 py-2">Path</th>
                              <th className="px-4 py-2">Level</th>
                              <th className="px-4 py-2">Start Date</th>
                              <th className="px-4 py-2">End Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(project.iterationPaths?.items || []).slice(0, 5).map((path: any, idx: number) => (
                              <tr key={idx} className="border-t">
                                <td className="px-4 py-2">{path.path}</td>
                                <td className="px-4 py-2">{path.level}</td>
                                <td className="px-4 py-2">{path.startDate ? new Date(path.startDate).toLocaleDateString() : '-'}</td>
                                <td className="px-4 py-2">{path.endDate ? new Date(path.endDate).toLocaleDateString() : '-'}</td>
                              </tr>
                            ))}
                            {(!project.iterationPaths?.items || project.iterationPaths.items.length === 0) && (
                              <tr>
                                <td colSpan={4} className="px-4 py-4 text-center text-gray-500">
                                  No iteration paths found
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>Iteration paths have not been extracted yet.</p>
                        <Button 
                          className="mt-4" 
                          onClick={() => startExtractionMutation.mutate({ projectId: project.id, artifactType: "iterationpaths" })}
                        >
                          Extract Iteration Paths
                        </Button>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="workitemtypes">
                    {project.workItemTypes?.extracted ? (
                      <div className="border rounded-md overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 text-left">
                              <th className="px-4 py-2">Name</th>
                              <th className="px-4 py-2">Reference Name</th>
                              <th className="px-4 py-2">Description</th>
                              <th className="px-4 py-2">Usage</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(project.workItemTypes?.items || []).slice(0, 5).map((type: any, idx: number) => (
                              <tr key={idx} className="border-t">
                                <td className="px-4 py-2">{type.name}</td>
                                <td className="px-4 py-2 font-mono text-xs">{type.referenceName}</td>
                                <td className="px-4 py-2 truncate max-w-[200px]">{type.description || '-'}</td>
                                <td className="px-4 py-2">{type.usage || 0}</td>
                              </tr>
                            ))}
                            {(!project.workItemTypes?.items || project.workItemTypes.items.length === 0) && (
                              <tr>
                                <td colSpan={4} className="px-4 py-4 text-center text-gray-500">
                                  No work item types found
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>Work item types have not been extracted yet.</p>
                        <Button 
                          className="mt-4" 
                          onClick={() => startExtractionMutation.mutate({ projectId: project.id, artifactType: "workitemtypes" })}
                        >
                          Extract Work Item Types
                        </Button>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="customfields">
                    {project.customFields?.extracted ? (
                      <div className="border rounded-md overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 text-left">
                              <th className="px-4 py-2">Name</th>
                              <th className="px-4 py-2">Reference Name</th>
                              <th className="px-4 py-2">Type</th>
                              <th className="px-4 py-2">Usage</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(project.customFields?.items || []).slice(0, 5).map((field: any, idx: number) => (
                              <tr key={idx} className="border-t">
                                <td className="px-4 py-2">{field.name}</td>
                                <td className="px-4 py-2 font-mono text-xs">{field.referenceName}</td>
                                <td className="px-4 py-2">{field.type}</td>
                                <td className="px-4 py-2">{field.usage || 0}</td>
                              </tr>
                            ))}
                            {(!project.customFields?.items || project.customFields.items.length === 0) && (
                              <tr>
                                <td colSpan={4} className="px-4 py-4 text-center text-gray-500">
                                  No custom fields found
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>Custom fields have not been extracted yet.</p>
                        <Button 
                          className="mt-4" 
                          onClick={() => startExtractionMutation.mutate({ projectId: project.id, artifactType: "customfields" })}
                        >
                          Extract Custom Fields
                        </Button>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="boardcolumns">
                    {project.boardColumns?.extracted ? (
                      <div className="border rounded-md overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 text-left">
                              <th className="px-4 py-2">Board</th>
                              <th className="px-4 py-2">Column</th>
                              <th className="px-4 py-2">State Mappings</th>
                              <th className="px-4 py-2">WIP Limit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(project.boardColumns?.items || []).slice(0, 5).map((column: any, idx: number) => (
                              <tr key={idx} className="border-t">
                                <td className="px-4 py-2">{column.boardName}</td>
                                <td className="px-4 py-2">{column.name}</td>
                                <td className="px-4 py-2">{column.stateMappings?.join(', ') || '-'}</td>
                                <td className="px-4 py-2">{column.wipLimit || 'None'}</td>
                              </tr>
                            ))}
                            {(!project.boardColumns?.items || project.boardColumns.items.length === 0) && (
                              <tr>
                                <td colSpan={4} className="px-4 py-4 text-center text-gray-500">
                                  No board columns found
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>Board columns have not been extracted yet.</p>
                        <Button 
                          className="mt-4" 
                          onClick={() => startExtractionMutation.mutate({ projectId: project.id, artifactType: "boardcolumns" })}
                        >
                          Extract Board Columns
                        </Button>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="wikipages">
                    {project.wikiPages?.extracted ? (
                      <div className="border rounded-md overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 text-left">
                              <th className="px-4 py-2">Title</th>
                              <th className="px-4 py-2">Path</th>
                              <th className="px-4 py-2">Last Updated</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(project.wikiPages?.items || []).slice(0, 5).map((page: any, idx: number) => (
                              <tr key={idx} className="border-t">
                                <td className="px-4 py-2">{page.title}</td>
                                <td className="px-4 py-2">{page.path}</td>
                                <td className="px-4 py-2">{page.lastUpdated ? new Date(page.lastUpdated).toLocaleDateString() : '-'}</td>
                              </tr>
                            ))}
                            {(!project.wikiPages?.items || project.wikiPages.items.length === 0) && (
                              <tr>
                                <td colSpan={3} className="px-4 py-4 text-center text-gray-500">
                                  No wiki pages found
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>Wiki pages have not been extracted yet.</p>
                        <Button 
                          className="mt-4" 
                          onClick={() => startExtractionMutation.mutate({ projectId: project.id, artifactType: "wikipages" })}
                        >
                          Extract Wiki Pages
                        </Button>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="history" className="p-4 border rounded-md mt-4">
                    <div className="border rounded-md overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-left">
                            <th className="px-4 py-2">Component</th>
                            <th className="px-4 py-2">Status</th>
                            <th className="px-4 py-2">Started</th>
                            <th className="px-4 py-2">Completed</th>
                            <th className="px-4 py-2">Items</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(project.extractionHistory || []).slice(0, 10).map((history: any, idx: number) => (
                            <tr key={idx} className="border-t">
                              <td className="px-4 py-2">{history.component}</td>
                              <td className="px-4 py-2">
                                <Badge className={
                                  history.status === 'completed' ? 'bg-green-100 text-green-800' :
                                  history.status === 'failed' ? 'bg-red-100 text-red-800' :
                                  history.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'
                                }>
                                  {history.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-2">{history.startTime ? new Date(history.startTime).toLocaleString() : '-'}</td>
                              <td className="px-4 py-2">{history.endTime ? new Date(history.endTime).toLocaleString() : '-'}</td>
                              <td className="px-4 py-2">{history.itemCount || 0}</td>
                            </tr>
                          ))}
                          {(!project.extractionHistory || project.extractionHistory.length === 0) && (
                            <tr>
                              <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                                No extraction history found
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </>
  );
};

// The component uses startExtractionMutation directly in the onClick handlers