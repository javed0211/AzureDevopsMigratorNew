import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { api } from "@/lib/api";
import { ArrowLeft, MessageSquare, History, Paperclip, Link2, ExternalLink } from "lucide-react";

interface WorkItem {
  id: number;
  externalId: number;
  title: string;
  workItemType: string;
  state: string;
  assignedTo: string;
  createdDate: string;
  changedDate: string;
  commentCount: number;
  revisionCount: number;
  attachmentCount: number;
  relationCount: number;
}

export default function WorkItemsPage() {
  const [match, params] = useRoute("/projects/:projectId/work-items");
  const projectId = match ? Number(params?.projectId) : null;
  const [location, setLocation] = useLocation();
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [projectName, setProjectName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setError("Invalid project ID");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch project name
        const projectResponse = await apiRequest("GET", `/api/projects/${projectId}`);
        
        if (!projectResponse.ok) {
          const errorMessage = `Failed to fetch project: ${projectResponse.status} ${projectResponse.statusText}`;
          console.error(errorMessage);
          setError(errorMessage);
          setLoading(false);
          return;
        }
        
        const projectData = await projectResponse.json();
        if (!projectData) {
          setError("No project data returned from server");
          setLoading(false);
          return;
        }
        
        setProjectName(projectData.name || `Project ${projectId}`);
        
        // Fetch work items
        const workItemsResponse = await apiRequest("GET", `/api/projects/${projectId}/workitems`);
        
        if (!workItemsResponse.ok) {
          const errorMessage = `Failed to fetch work items: ${workItemsResponse.status} ${workItemsResponse.statusText}`;
          console.error(errorMessage);
          setError(errorMessage);
          setLoading(false);
          return;
        }
        
        const workItemsData = await workItemsResponse.json();
        console.log("Work items data:", workItemsData);
        
        // Check if workItemsData is an array
        if (Array.isArray(workItemsData)) {
          setWorkItems(workItemsData);
        } else if (workItemsData && typeof workItemsData === 'object') {
          // If it's an object with items property
          if (Array.isArray(workItemsData.items)) {
            setWorkItems(workItemsData.items);
          } else {
            // If it's just an object with work items as properties
            const itemsArray = Object.values(workItemsData).filter((item): item is WorkItem => 
              item !== null && 
              typeof item === 'object' && 
              'id' in item &&
              'externalId' in item &&
              'title' in item &&
              'workItemType' in item &&
              'state' in item
            );
            setWorkItems(itemsArray);
          }
        } else {
          setWorkItems([]);
          setError("Invalid work items data format returned from server");
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        console.error("Failed to fetch data:", error);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [projectId]);

  const handleViewWorkItem = (workItemId: number) => {
    setLocation(`/workitems/${workItemId}`);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 max-w-md mx-auto text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto"></div>
          <h2 className="text-xl font-bold text-blue-700 mt-4">Loading Work Items</h2>
          <p className="mt-2 text-blue-600">
            Please wait while we load the work items...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md mx-auto text-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 mx-auto mb-4"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
          <h2 className="text-2xl font-bold text-red-700">Work Items Not Found</h2>
          <p className="mt-2 text-red-600 mb-6">
            {error || "Could not find work items for this project. Please make sure the project exists and work items have been extracted."}
          </p>
          <div className="flex gap-2 justify-center">
            <Button 
              variant="outline" 
              className="bg-white border-red-200 text-red-700 hover:bg-red-50"
              onClick={() => window.history.back()}
            >
              Go Back
            </Button>
            <Button 
              className="bg-red-600 hover:bg-red-700"
              onClick={() => setLocation("/")}
            >
              Back to Projects
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!Array.isArray(workItems) || workItems.length === 0) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <Button 
              variant="outline" 
              size="sm" 
              className="mr-4"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">Work Items for {projectName}</h1>
          </div>
        </div>

        <Card>
          <CardHeader className="bg-blue-50 border-b border-blue-200">
            <CardTitle className="text-blue-800">Work Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-gray-500">No work items have been extracted yet.</p>
              <Button 
                className="mt-4" 
                onClick={() => setLocation(`/extraction`)}
              >
                Go to Extraction
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <Button 
            variant="outline" 
            size="sm" 
            className="mr-4"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Work Items for {projectName}</h1>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between bg-blue-50 border-b border-blue-200">
          <div>
            <CardTitle className="text-blue-800">Work Items</CardTitle>
            <p className="text-sm text-blue-600 mt-1">
              List of all work items extracted from Azure DevOps
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead className="text-center">Metadata</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.isArray(workItems) && workItems.map((item) => (
                  <TableRow key={item.id} className="cursor-pointer hover:bg-gray-50">
                    <TableCell className="font-medium">{item.externalId}</TableCell>
                    <TableCell className="max-w-md truncate">{item.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                        {item.workItemType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        item.state === 'Closed' || item.state === 'Done' || item.state === 'Completed' 
                          ? 'bg-green-50 text-green-700'
                          : item.state === 'Active' || item.state === 'In Progress'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-gray-50 text-gray-700'
                      }>
                        {item.state}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.assignedTo || "-"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 justify-center">
                        {item.commentCount > 0 ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 flex items-center gap-1 hover:bg-blue-100">
                            <MessageSquare size={12} />
                            {item.commentCount}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-400 flex items-center gap-1">
                            <MessageSquare size={12} />
                            0
                          </Badge>
                        )}
                        {item.revisionCount > 0 ? (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 flex items-center gap-1 hover:bg-purple-100">
                            <History size={12} />
                            {item.revisionCount}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-400 flex items-center gap-1">
                            <History size={12} />
                            0
                          </Badge>
                        )}
                        {item.attachmentCount > 0 ? (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 flex items-center gap-1 hover:bg-amber-100">
                            <Paperclip size={12} />
                            {item.attachmentCount}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-400 flex items-center gap-1">
                            <Paperclip size={12} />
                            0
                          </Badge>
                        )}
                        {item.relationCount > 0 ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 flex items-center gap-1 hover:bg-green-100">
                            <Link2 size={12} />
                            {item.relationCount}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-400 flex items-center gap-1">
                            <Link2 size={12} />
                            0
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-800"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewWorkItem(item.id);
                        }}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}