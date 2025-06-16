import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";

interface WorkItemDetail {
  id: number;
  externalId: number;
  title: string;
  workItemType: string;
  state: string;
  assignedTo: string;
  createdDate: string;
  changedDate: string;
  areaPath: string;
  iterationPath: string;
  priority: number;
  tags: string;
  description: string;
  fields: Record<string, any>;
  projectId: number;
  projectName: string;
  revisions: {
    id: number;
    revisionNumber: number;
    changedBy: string;
    changedDate: string;
    fields: Record<string, any>;
  }[];
  comments: {
    id: number;
    text: string;
    createdBy: string;
    createdDate: string;
  }[];
  attachments: {
    id: number;
    name: string;
    url: string;
    size: number;
    createdBy: string;
    createdDate: string;
  }[];
  relations: {
    id: number;
    relationType: string;
    targetWorkItemId: number;
    targetWorkItemTitle: string;
    targetWorkItemType: string;
    targetWorkItemState: string;
  }[];
  revisionCount: number;
  commentCount: number;
  attachmentCount: number;
  relationCount: number;
}

export default function WorkItemDetailsPage() {
  const [match, params] = useRoute("/workitems/:workItemId");
  const workItemId = params?.workItemId;
  const [, setLocation] = useLocation();
  const [workItem, setWorkItem] = useState<WorkItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("details");

  useEffect(() => {
    if (!workItemId) return;

    const fetchWorkItem = async () => {
      try {
        setLoading(true);
        const data = await apiRequest("GET", `/api/workitems/${workItemId}`).then(res => res.json());
        setWorkItem(data);
      } catch (error) {
        console.error("Failed to fetch work item details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkItem();
  }, [workItemId]);

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 max-w-md mx-auto text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto"></div>
          <h2 className="text-xl font-bold text-blue-700 mt-4">Loading Work Item Metadata</h2>
          <p className="mt-2 text-blue-600">
            Please wait while we load all metadata for this work item...
          </p>
        </div>
      </div>
    );
  }

  if (!workItem) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md mx-auto text-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 mx-auto mb-4"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
          <h2 className="text-2xl font-bold text-red-700">Work Item Metadata Not Found</h2>
          <p className="mt-2 text-red-600 mb-6">
            Could not find metadata for this work item. Please make sure the work item exists and has been extracted.
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

  return (
    <div className="container mx-auto p-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-blue-800">Work Item Metadata Explorer</h1>
            <p className="text-blue-600 mt-1">
              Explore all metadata extracted from Azure DevOps including comments, revisions, attachments, and relations
            </p>
            <div className="flex items-center gap-2 mt-3">
              <h2 className="text-xl font-semibold">{workItem.title}</h2>
              <Badge className="bg-blue-100 text-blue-700 border-blue-300">{workItem.workItemType}</Badge>
              <Badge variant="outline" className={
                workItem.state === "Closed" || workItem.state === "Done" || workItem.state === "Completed" 
                  ? "bg-green-50 text-green-700 border-green-200"
                  : workItem.state === "Active" || workItem.state === "In Progress"
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-gray-50 text-gray-700 border-gray-200"
              }>
                {workItem.state}
              </Badge>
            </div>
            <p className="text-gray-600 mt-1">
              ID: {workItem.externalId} | Project: {workItem.projectName}
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="bg-white border-blue-200 text-blue-700 hover:bg-blue-50"
              onClick={() => setLocation(`/projects/${workItem.projectId}/migration-summary?tab=workitems`)}
            >
              Back to Work Items
            </Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => setLocation("/")}
            >
              Back to Projects
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 grid grid-cols-5 bg-blue-50 p-1 rounded-lg">
          <TabsTrigger 
            value="details" 
            className="flex items-center gap-1 data-[state=active]:bg-white data-[state=active]:text-blue-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file-text"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>
            Details
          </TabsTrigger>
          <TabsTrigger 
            value="comments" 
            className="flex items-center gap-1 data-[state=active]:bg-white data-[state=active]:text-blue-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-message-square"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Comments
            {workItem.commentCount > 0 && (
              <span className="ml-1 bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 text-xs font-semibold">
                {workItem.commentCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="revisions" 
            className="flex items-center gap-1 data-[state=active]:bg-white data-[state=active]:text-blue-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-history"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
            Revisions
            {workItem.revisionCount > 0 && (
              <span className="ml-1 bg-purple-100 text-purple-700 rounded-full px-2 py-0.5 text-xs font-semibold">
                {workItem.revisionCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="attachments" 
            className="flex items-center gap-1 data-[state=active]:bg-white data-[state=active]:text-blue-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-paperclip"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            Attachments
            {workItem.attachmentCount > 0 && (
              <span className="ml-1 bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 text-xs font-semibold">
                {workItem.attachmentCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="relations" 
            className="flex items-center gap-1 data-[state=active]:bg-white data-[state=active]:text-blue-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-link-2"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/></svg>
            Relations
            {workItem.relationCount > 0 && (
              <span className="ml-1 bg-green-100 text-green-700 rounded-full px-2 py-0.5 text-xs font-semibold">
                {workItem.relationCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader className="bg-gray-50 border-b border-gray-200">
                <CardTitle>Work Item Details</CardTitle>
                <CardDescription>Basic information about this work item</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold text-sm text-gray-500">ID</h3>
                    <p>{workItem.externalId}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-gray-500">Type</h3>
                    <p>{workItem.workItemType}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-gray-500">State</h3>
                    <p>{workItem.state}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-gray-500">Assigned To</h3>
                    <p>{workItem.assignedTo || "-"}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-gray-500">Created Date</h3>
                    <p>{new Date(workItem.createdDate).toLocaleString()}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-gray-500">Changed Date</h3>
                    <p>{new Date(workItem.changedDate).toLocaleString()}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-gray-500">Area Path</h3>
                    <p>{workItem.areaPath}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-gray-500">Iteration Path</h3>
                    <p>{workItem.iterationPath}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-gray-500">Priority</h3>
                    <p>{workItem.priority}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-gray-500">Tags</h3>
                    <p>{workItem.tags || "-"}</p>
                  </div>
                </div>

                {workItem.description && (
                  <>
                    <Separator className="my-4" />
                    <div>
                      <h3 className="font-semibold text-sm text-gray-500 mb-2">Description</h3>
                      <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: workItem.description }} />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="bg-blue-50 border-b border-blue-200">
                <CardTitle className="text-blue-800">Metadata Summary</CardTitle>
                <CardDescription>Complete metadata extracted from Azure DevOps</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-white p-3 rounded-md border border-blue-200 flex items-center">
                    <div className="bg-blue-100 p-2 rounded-full mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-700"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    </div>
                    <div>
                      <div className="text-sm text-blue-700">Comments</div>
                      <div className="text-lg font-semibold text-blue-800">{workItem.commentCount}</div>
                    </div>
                  </div>
                  
                  <div className="bg-white p-3 rounded-md border border-purple-200 flex items-center">
                    <div className="bg-purple-100 p-2 rounded-full mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-700"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
                    </div>
                    <div>
                      <div className="text-sm text-purple-700">Revisions</div>
                      <div className="text-lg font-semibold text-purple-800">{workItem.revisionCount}</div>
                    </div>
                  </div>
                  
                  <div className="bg-white p-3 rounded-md border border-amber-200 flex items-center">
                    <div className="bg-amber-100 p-2 rounded-full mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-700"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                    </div>
                    <div>
                      <div className="text-sm text-amber-700">Attachments</div>
                      <div className="text-lg font-semibold text-amber-800">{workItem.attachmentCount}</div>
                    </div>
                  </div>
                  
                  <div className="bg-white p-3 rounded-md border border-green-200 flex items-center">
                    <div className="bg-green-100 p-2 rounded-full mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-700"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/></svg>
                    </div>
                    <div>
                      <div className="text-sm text-green-700">Relations</div>
                      <div className="text-lg font-semibold text-green-800">{workItem.relationCount}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="revisions">
          <Card>
            <CardHeader>
              <CardTitle>Revisions History</CardTitle>
              <CardDescription>All changes made to this work item</CardDescription>
            </CardHeader>
            <CardContent>
              {workItem.revisions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No revisions found for this work item.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Revision</TableHead>
                        <TableHead>Changed By</TableHead>
                        <TableHead>Changed Date</TableHead>
                        <TableHead>Changes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workItem.revisions.map((revision) => (
                        <TableRow key={revision.id}>
                          <TableCell>{revision.revisionNumber}</TableCell>
                          <TableCell>{revision.changedBy}</TableCell>
                          <TableCell>{new Date(revision.changedDate).toLocaleString()}</TableCell>
                          <TableCell>
                            <details className="cursor-pointer">
                              <summary>View Changes</summary>
                              <div className="mt-2 text-sm">
                                <pre className="bg-gray-100 p-2 rounded overflow-x-auto">
                                  {JSON.stringify(revision.fields, null, 2)}
                                </pre>
                              </div>
                            </details>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comments">
          <Card>
            <CardHeader>
              <CardTitle>Comments</CardTitle>
              <CardDescription>All comments on this work item</CardDescription>
            </CardHeader>
            <CardContent>
              {workItem.comments.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No comments found for this work item.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {workItem.comments.map((comment) => (
                    <div key={comment.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-semibold">{comment.createdBy}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(comment.createdDate).toLocaleString()}
                        </div>
                      </div>
                      <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: comment.text }} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attachments">
          <Card>
            <CardHeader>
              <CardTitle>Attachments</CardTitle>
              <CardDescription>Files attached to this work item</CardDescription>
            </CardHeader>
            <CardContent>
              {workItem.attachments.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No attachments found for this work item.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Created By</TableHead>
                        <TableHead>Created Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workItem.attachments.map((attachment) => (
                        <TableRow key={attachment.id}>
                          <TableCell>{attachment.name}</TableCell>
                          <TableCell>{formatFileSize(attachment.size)}</TableCell>
                          <TableCell>{attachment.createdBy}</TableCell>
                          <TableCell>{new Date(attachment.createdDate).toLocaleString()}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" asChild>
                              <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                                View
                              </a>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="relations">
          <Card>
            <CardHeader>
              <CardTitle>Relations</CardTitle>
              <CardDescription>Work items related to this item</CardDescription>
            </CardHeader>
            <CardContent>
              {workItem.relations.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No relations found for this work item.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Relation Type</TableHead>
                        <TableHead>Work Item ID</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workItem.relations.map((relation) => (
                        <TableRow key={relation.id}>
                          <TableCell>{formatRelationType(relation.relationType)}</TableCell>
                          <TableCell>{relation.targetWorkItemId}</TableCell>
                          <TableCell>{relation.targetWorkItemTitle}</TableCell>
                          <TableCell>{relation.targetWorkItemType}</TableCell>
                          <TableCell>{relation.targetWorkItemState}</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setLocation(`/workitems/${relation.targetWorkItemId}`)}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatRelationType(relationType: string): string {
  // Convert camelCase to readable format
  return relationType
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase());
}