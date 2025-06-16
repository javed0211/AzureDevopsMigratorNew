import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WorkItem, MigrationSummary } from "./types";
import { api } from "@/lib/api";
import { format } from "date-fns";
import { MessageSquare, History, Paperclip, Link2, ExternalLink, FileText, Calendar, User, Tag } from "lucide-react";

interface WorkItemsTabProps {
  workItems: WorkItem[];
  summary: MigrationSummary;
  startExtraction: (artifactType: string) => Promise<void>;
}

export function WorkItemsTab({ workItems, summary, startExtraction }: WorkItemsTabProps) {
  const [selectedWorkItem, setSelectedWorkItem] = useState<number | null>(null);
  
  // Close the dialog
  const handleCloseDialog = () => {
    setSelectedWorkItem(null);
  };
  
  // Listen for the custom event to view related work items
  useEffect(() => {
    const handleViewRelatedWorkItem = (event: Event) => {
      const customEvent = event as CustomEvent<{ workItemId: number }>;
      if (customEvent.detail && customEvent.detail.workItemId) {
        setSelectedWorkItem(customEvent.detail.workItemId);
      }
    };
    
    document.addEventListener('viewRelatedWorkItem', handleViewRelatedWorkItem);
    
    return () => {
      document.removeEventListener('viewRelatedWorkItem', handleViewRelatedWorkItem);
    };
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between bg-blue-50 border-b border-blue-200">
        <div>
          <CardTitle className="text-blue-800">Work Items</CardTitle>
          <p className="text-sm text-blue-600 mt-1">
            List of all work items extracted from Azure DevOps
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            className="bg-white text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-800"
            onClick={() => {
              if (workItems.length > 0) {
                setSelectedWorkItem(workItems[0].id);
              }
            }}
            disabled={workItems.length === 0}
          >
            <FileText className="mr-2 h-4 w-4" />
            Open First Work Item
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {workItems.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No work items have been extracted yet.</p>
            {!summary.extractionStatus.workItems && (
              <Button className="mt-4" onClick={() => startExtraction("workitems")}>
                Extract Work Items
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-blue-800 mb-2">Work Item Metadata Summary</h3>
              <p className="text-blue-700 mb-4">
                All work items have been extracted with their complete metadata. Click on any work item row or use the "View Metadata" button to explore:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-3 rounded-md border border-blue-200 flex items-center">
                  <div className="bg-blue-100 p-2 rounded-full mr-3">
                    <MessageSquare className="h-5 w-5 text-blue-700" />
                  </div>
                  <div>
                    <div className="text-sm text-blue-700">Comments</div>
                    <div className="text-lg font-semibold text-blue-800">
                      {workItems.reduce((sum, item) => sum + (item.commentCount || 0), 0)}
                    </div>
                  </div>
                </div>
                <div className="bg-white p-3 rounded-md border border-purple-200 flex items-center">
                  <div className="bg-purple-100 p-2 rounded-full mr-3">
                    <History className="h-5 w-5 text-purple-700" />
                  </div>
                  <div>
                    <div className="text-sm text-purple-700">Revisions</div>
                    <div className="text-lg font-semibold text-purple-800">
                      {workItems.reduce((sum, item) => sum + (item.revisionCount || 0), 0)}
                    </div>
                  </div>
                </div>
                <div className="bg-white p-3 rounded-md border border-amber-200 flex items-center">
                  <div className="bg-amber-100 p-2 rounded-full mr-3">
                    <Paperclip className="h-5 w-5 text-amber-700" />
                  </div>
                  <div>
                    <div className="text-sm text-amber-700">Attachments</div>
                    <div className="text-lg font-semibold text-amber-800">
                      {workItems.reduce((sum, item) => sum + (item.attachmentCount || 0), 0)}
                    </div>
                  </div>
                </div>
                <div className="bg-white p-3 rounded-md border border-green-200 flex items-center">
                  <div className="bg-green-100 p-2 rounded-full mr-3">
                    <Link2 className="h-5 w-5 text-green-700" />
                  </div>
                  <div>
                    <div className="text-sm text-green-700">Relations</div>
                    <div className="text-lg font-semibold text-green-800">
                      {workItems.reduce((sum, item) => sum + (item.relationCount || 0), 0)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
                {workItems.map((item) => (
                  <TableRow 
                    key={item.id} 
                    className="cursor-pointer hover:bg-blue-50"
                    onClick={() => setSelectedWorkItem(item.id)}
                  >
                    <TableCell>{item.externalId}</TableCell>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-100">
                        {item.workItemType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        item.state === 'Closed' || item.state === 'Done' || item.state === 'Completed' 
                          ? 'bg-green-50 text-green-700 hover:bg-green-100'
                          : item.state === 'Active' || item.state === 'In Progress'
                          ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }>
                        {item.state}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.assignedTo || "-"}</TableCell>
                    <TableCell>
                      <div className="flex justify-center space-x-2">
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
                          setSelectedWorkItem(item.id);
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
          </>
        )}
      </CardContent>

      {/* Work Item Details Dialog */}
      <WorkItemDetailsDialog 
        workItemId={selectedWorkItem} 
        open={selectedWorkItem !== null} 
        onClose={handleCloseDialog} 
      />
    </Card>
  );
}

interface WorkItemDetailsDialogProps {
  workItemId: number | null;
  open: boolean;
  onClose: () => void;
}

function WorkItemDetailsDialog({ workItemId, open, onClose }: WorkItemDetailsDialogProps) {
  // Fetch work item details when dialog is open
  const { data: workItem, isLoading } = useQuery({
    queryKey: [`/api/workitems/${workItemId}`],
    queryFn: () => api.workItems.getDetails(workItemId!),
    enabled: open && workItemId !== null,
  });

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "MMM d, yyyy h:mm a");
    } catch (error) {
      return dateString;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b pb-4">
          <div className="bg-blue-50 -mt-6 -mx-6 px-6 py-4 mb-4 border-b border-blue-200">
            <h2 className="text-xl font-bold text-blue-800 mb-1">Work Item Details</h2>
            <p className="text-blue-600 text-sm">
              View detailed information and metadata for this work item
            </p>
          </div>
          
          <DialogTitle className="flex items-center gap-2 text-xl">
            {isLoading ? (
              "Loading work item details..."
            ) : (
              <>
                <span>#{workItem?.externalId}</span>
                <span>{workItem?.title}</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {!isLoading && workItem && (
              <div className="flex items-center gap-3 mt-1">
                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                  {workItem.workItemType}
                </Badge>
                <Badge variant="outline" className={
                  workItem.state === 'Closed' || workItem.state === 'Done' || workItem.state === 'Completed' 
                    ? 'bg-green-50 text-green-700'
                    : workItem.state === 'Active' || workItem.state === 'In Progress'
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-gray-50 text-gray-700'
                }>
                  {workItem.state}
                </Badge>
                
                <div className="flex ml-auto space-x-2">
                  {workItem.commentCount > 0 && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 flex items-center gap-1">
                      <MessageSquare size={12} />
                      {workItem.commentCount} Comments
                    </Badge>
                  )}
                  {workItem.revisionCount > 0 && (
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 flex items-center gap-1">
                      <History size={12} />
                      {workItem.revisionCount} Revisions
                    </Badge>
                  )}
                  {workItem.attachmentCount > 0 && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 flex items-center gap-1">
                      <Paperclip size={12} />
                      {workItem.attachmentCount} Attachments
                    </Badge>
                  )}
                  {workItem.relationCount > 0 && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 flex items-center gap-1">
                      <Link2 size={12} />
                      {workItem.relationCount} Relations
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : workItem ? (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Work Item Overview */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex items-center gap-2">
                <User size={16} className="text-gray-500" />
                <span className="text-sm text-gray-500">Assigned to:</span>
                <span className="text-sm font-medium">{workItem.assignedTo || "Unassigned"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-gray-500" />
                <span className="text-sm text-gray-500">Created:</span>
                <span className="text-sm font-medium">{formatDate(workItem.createdDate)}</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-gray-500" />
                <span className="text-sm text-gray-500">Area Path:</span>
                <span className="text-sm font-medium">{workItem.areaPath}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-gray-500" />
                <span className="text-sm text-gray-500">Iteration:</span>
                <span className="text-sm font-medium">{workItem.iterationPath}</span>
              </div>
              {workItem.tags && (
                <div className="flex items-center gap-2 col-span-2">
                  <Tag size={16} className="text-gray-500" />
                  <span className="text-sm text-gray-500">Tags:</span>
                  <div className="flex flex-wrap gap-1">
                    {workItem.tags.split(';').map((tag: string, index: number) => (
                      <Badge key={index} variant="outline" className="bg-gray-50">
                        {tag.trim()}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tabs for different sections */}
            <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="grid grid-cols-5 bg-blue-50 p-1 rounded-lg">
                <TabsTrigger 
                  value="details" 
                  className="flex items-center gap-1 data-[state=active]:bg-white data-[state=active]:text-blue-700"
                >
                  <FileText size={16} />
                  Details
                </TabsTrigger>
                <TabsTrigger 
                  value="comments" 
                  className="flex items-center gap-1 data-[state=active]:bg-white data-[state=active]:text-blue-700"
                >
                  <MessageSquare size={16} />
                  Comments
                  {workItem.commentCount > 0 && (
                    <Badge variant="secondary" className="ml-1 bg-blue-100 text-blue-700">{workItem.commentCount}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="history" 
                  className="flex items-center gap-1 data-[state=active]:bg-white data-[state=active]:text-blue-700"
                >
                  <History size={16} />
                  History
                  {workItem.revisionCount > 0 && (
                    <Badge variant="secondary" className="ml-1 bg-purple-100 text-purple-700">{workItem.revisionCount}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="attachments" 
                  className="flex items-center gap-1 data-[state=active]:bg-white data-[state=active]:text-blue-700"
                >
                  <Paperclip size={16} />
                  Attachments
                  {workItem.attachmentCount > 0 && (
                    <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-700">{workItem.attachmentCount}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="relations" 
                  className="flex items-center gap-1 data-[state=active]:bg-white data-[state=active]:text-blue-700"
                >
                  <Link2 size={16} />
                  Relations
                  {workItem.relationCount > 0 && (
                    <Badge variant="secondary" className="ml-1 bg-green-100 text-green-700">{workItem.relationCount}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 mt-4">
                <TabsContent value="details" className="m-0">
                  <div className="space-y-4">
                    {workItem.description && (
                      <div>
                        <h3 className="text-sm font-medium mb-2">Description</h3>
                        <div className="text-sm p-4 bg-gray-50 rounded-md border border-gray-200 whitespace-pre-wrap" 
                          dangerouslySetInnerHTML={{ __html: workItem.description }} 
                        />
                      </div>
                    )}

                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="fields">
                        <AccordionTrigger>All Fields</AccordionTrigger>
                        <AccordionContent>
                          <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                            <pre className="text-xs overflow-auto">
                              {JSON.stringify(workItem.fields, null, 2)}
                            </pre>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                </TabsContent>

                <TabsContent value="comments" className="m-0">
                  {workItem.comments && workItem.comments.length > 0 ? (
                    <div className="space-y-4">
                      {workItem.comments.map((comment: any) => (
                        <div key={comment.id} className="p-4 border border-gray-200 rounded-md">
                          <div className="flex justify-between mb-2">
                            <div className="font-medium text-sm">{comment.createdBy}</div>
                            <div className="text-xs text-gray-500">{formatDate(comment.createdDate)}</div>
                          </div>
                          <div className="text-sm whitespace-pre-wrap">{comment.text}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No comments found for this work item.
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="history" className="m-0">
                  {workItem.revisions && workItem.revisions.length > 0 ? (
                    <div className="space-y-4">
                      {workItem.revisions.map((revision: any) => (
                        <div key={revision.id} className="p-4 border border-gray-200 rounded-md">
                          <div className="flex justify-between mb-2">
                            <div className="font-medium text-sm">
                              Revision {revision.revisionNumber} by {revision.changedBy}
                            </div>
                            <div className="text-xs text-gray-500">{formatDate(revision.changedDate)}</div>
                          </div>
                          <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="fields">
                              <AccordionTrigger>View Changes</AccordionTrigger>
                              <AccordionContent>
                                <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                                  <pre className="text-xs overflow-auto">
                                    {JSON.stringify(revision.fields, null, 2)}
                                  </pre>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No revision history found for this work item.
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="attachments" className="m-0">
                  {workItem.attachments && workItem.attachments.length > 0 ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {workItem.attachments.map((attachment: any) => (
                          <div key={attachment.id} className="p-4 border border-gray-200 rounded-md flex items-center">
                            <Paperclip className="text-gray-400 mr-3" size={20} />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{attachment.name}</div>
                              <div className="text-xs text-gray-500">
                                {formatFileSize(attachment.size)} • {formatDate(attachment.createdDate)}
                              </div>
                            </div>
                            <a 
                              href={attachment.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="ml-2 text-blue-600 hover:text-blue-800"
                            >
                              <ExternalLink size={16} />
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No attachments found for this work item.
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="relations" className="m-0">
                  {workItem.relations && workItem.relations.length > 0 ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        {workItem.relations.map((relation: any) => {
                          const handleViewRelation = () => {
                            onClose();
                            // Use the parent component's setSelectedWorkItem function
                            setTimeout(() => {
                              const event = new CustomEvent('viewRelatedWorkItem', { 
                                detail: { workItemId: relation.targetWorkItemId } 
                              });
                              document.dispatchEvent(event);
                            }, 100);
                          };
                          
                          return (
                            <div key={relation.id} className="p-4 border border-gray-200 rounded-md">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <Badge variant="outline" className="mr-3">
                                    {formatRelationType(relation.relationType)}
                                  </Badge>
                                  <div>
                                    <div className="font-medium">
                                      #{relation.targetWorkItemId} {relation.targetWorkItemTitle}
                                    </div>
                                    <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                        {relation.targetWorkItemType}
                                      </Badge>
                                      <Badge variant="outline" className={
                                        relation.targetWorkItemState === 'Closed' || relation.targetWorkItemState === 'Done' || relation.targetWorkItemState === 'Completed' 
                                          ? 'bg-green-50 text-green-700'
                                          : relation.targetWorkItemState === 'Active' || relation.targetWorkItemState === 'In Progress'
                                          ? 'bg-blue-50 text-blue-700'
                                          : 'bg-gray-50 text-gray-700'
                                      }>
                                        {relation.targetWorkItemState}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={handleViewRelation}
                                >
                                  View
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No relations found for this work item.
                    </div>
                  )}
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            Work item not found or failed to load.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Helper function to format file size
function formatFileSize(bytes?: number): string {
  if (!bytes) return "0 B";
  
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  
  return `${bytes.toFixed(1)} ${units[i]}`;
}

// Helper function to format relation type
function formatRelationType(relationType?: string): string {
  if (!relationType) return "Related";
  
  // Convert from ADO relation types to readable format
  switch (relationType) {
    case "System.LinkTypes.Hierarchy-Forward":
      return "Parent of";
    case "System.LinkTypes.Hierarchy-Reverse":
      return "Child of";
    case "System.LinkTypes.Related":
      return "Related to";
    case "System.LinkTypes.Dependency-Forward":
      return "Successor of";
    case "System.LinkTypes.Dependency-Reverse":
      return "Predecessor of";
    default:
      // Convert camelCase or hyphenated to readable format
      return relationType
        .replace(/([A-Z])/g, ' $1')
        .replace(/-/g, ' ')
        .replace(/^./, str => str.toUpperCase());
  }
}