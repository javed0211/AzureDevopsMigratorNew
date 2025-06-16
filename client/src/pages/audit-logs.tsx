import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Search, AlertCircle, Info, AlertTriangle, RefreshCw, Clock, CheckCircle } from "lucide-react";
import { api } from "@/lib/api";
import { format } from "date-fns";

export default function AuditLogs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [logLevel, setLogLevel] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 20;

  // Fetch logs summary
  const { 
    data: summary, 
    isLoading: summaryLoading,
    refetch: refetchSummary
  } = useQuery({
    queryKey: ['/api/logs/summary'],
    queryFn: () => api.logs.getSummary(),
  });

  // Fetch detailed logs with filters
  const { 
    data: logsData, 
    isLoading: logsLoading,
    refetch: refetchLogs
  } = useQuery({
    queryKey: ['/api/logs', logLevel, searchTerm, page, limit],
    queryFn: () => api.logs.getLogs({
      level: logLevel !== "all" ? logLevel : undefined,
      search: searchTerm || undefined,
      offset: (page - 1) * limit,
      limit
    }),
  });

  // Handle search
  const handleSearch = () => {
    setPage(1);
    refetchLogs();
  };

  // Handle export logs
  const handleExportLogs = () => {
    // Implementation for exporting logs
    alert("Exporting logs functionality will be implemented here");
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "yyyy-MM-dd HH:mm:ss");
    } catch (error) {
      return dateString;
    }
  };

  // Get icon based on log level
  const getLogIcon = (level) => {
    switch (level?.toUpperCase()) {
      case "ERROR":
        return <AlertCircle className="text-red-500 mt-1" size={16} />;
      case "WARNING":
        return <AlertTriangle className="text-orange-500 mt-1" size={16} />;
      case "INFO":
        return <Info className="text-blue-500 mt-1" size={16} />;
      default:
        return <Info className="text-gray-500 mt-1" size={16} />;
    }
  };

  // Get status badge for timeline events
  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "in_progress":
        return (
          <Badge className="bg-blue-100 text-blue-800">
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            In Progress
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-800">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case "queued":
        return (
          <Badge className="bg-gray-100 text-gray-800">
            <Clock className="h-3 w-3 mr-1" />
            Queued
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-100 text-gray-800">
            {status || "Unknown"}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Audit & Logs</h2>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => {
              refetchSummary();
              refetchLogs();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExportLogs}>
            <Download className="h-4 w-4 mr-2" />
            Export Logs
          </Button>
        </div>
      </div>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="summary" className="text-base">Summary</TabsTrigger>
          <TabsTrigger value="errors" className="text-base">Errors</TabsTrigger>
          <TabsTrigger value="timeline" className="text-base">Timeline</TabsTrigger>
          <TabsTrigger value="logs" className="text-base">Detailed Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-6">
          {summaryLoading ? (
            <div className="flex justify-center p-8">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Info className="text-blue-500 text-xl mr-3" />
                    <div>
                      <div className="text-sm font-medium text-gray-500">Total Operations</div>
                      <div className="text-2xl font-bold text-gray-900">{summary?.total_operations.toLocaleString() || 0}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <AlertTriangle className="text-orange-500 text-xl mr-3" />
                    <div>
                      <div className="text-sm font-medium text-gray-500">Warnings</div>
                      <div className="text-2xl font-bold text-gray-900">{summary?.warning_count.toLocaleString() || 0}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <AlertCircle className="text-red-500 text-xl mr-3" />
                    <div>
                      <div className="text-sm font-medium text-gray-500">Errors</div>
                      <div className="text-2xl font-bold text-gray-900">{summary?.error_count.toLocaleString() || 0}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <CheckCircle className="text-green-500 text-xl mr-3" />
                    <div>
                      <div className="text-sm font-medium text-gray-500">Success Rate</div>
                      <div className="text-2xl font-bold text-gray-900">{summary?.success_rate || 100}%</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          {summaryLoading ? (
            <div className="flex justify-center p-8">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : summary?.recent_errors?.length > 0 ? (
            summary.recent_errors.map((error, index) => (
              <Card key={error.id || index}>
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <AlertCircle className="text-red-500 mr-2" />
                    {error.message?.split(':')[0] || "Error Occurred"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600">
                      <strong>Project:</strong> {error.project_name}
                    </div>
                    <div className="text-sm text-gray-600">
                      <strong>Time:</strong> {formatDate(error.timestamp)}
                    </div>
                    <div className="text-sm text-red-600">
                      <strong>Error:</strong> {error.message}
                    </div>
                    {error.details && (
                      <div className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded border border-gray-200 max-h-32 overflow-auto">
                        <pre>{typeof error.details === 'object' ? JSON.stringify(error.details, null, 2) : error.details}</pre>
                      </div>
                    )}
                    <Button size="sm" variant="outline">
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No Errors Found</h3>
                <p className="text-gray-500">All operations are running smoothly.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Migration Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <div className="flex justify-center p-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : summary?.timeline_events?.length > 0 ? (
                <div className="space-y-4">
                  {summary.timeline_events.map((event, index) => (
                    <div key={event.id || index} className="flex items-center space-x-4">
                      <div className={`w-2 h-2 rounded-full ${
                        event.status === 'completed' ? 'bg-green-500' :
                        event.status === 'failed' ? 'bg-red-500' :
                        event.status === 'in_progress' ? 'bg-blue-500' :
                        'bg-gray-500'
                      }`}></div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          {event.project_name} - {event.artifact_type.charAt(0).toUpperCase() + event.artifact_type.slice(1)} {
                            event.status === 'completed' ? 'Completed' :
                            event.status === 'failed' ? 'Failed' :
                            event.status === 'in_progress' ? 'In Progress' :
                            'Queued'
                          }
                        </div>
                        <div className="text-xs text-gray-500">{formatDate(event.started_at)}</div>
                      </div>
                      {getStatusBadge(event.status)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8">
                  <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No Timeline Events</h3>
                  <p className="text-gray-500">No recent migration activities found.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <Input 
                placeholder="Search logs..." 
                className="w-full" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Select 
              value={logLevel} 
              onValueChange={(value) => {
                setLogLevel(value);
                setPage(1);
                setTimeout(() => refetchLogs(), 0);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {logsLoading ? (
                <div className="flex justify-center p-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : logsData?.logs?.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {logsData.logs.map((log) => (
                    <div key={log.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start space-x-3">
                        {getLogIcon(log.level)}
                        <div className="flex-1">
                          <div className="text-sm">
                            <span className="text-gray-500">{formatDate(log.timestamp)}</span>
                            <span className="mx-2">|</span>
                            <span className="font-medium">{log.project_name}</span>
                            <span className="mx-2">|</span>
                            <span className={`font-medium ${
                              log.level === 'ERROR' ? 'text-red-600' :
                              log.level === 'WARNING' ? 'text-orange-600' :
                              'text-gray-700'
                            }`}>
                              {log.level}:
                            </span>
                            <span className="ml-1">{log.message}</span>
                          </div>
                          {log.details && (
                            <div className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded border border-gray-200 max-h-24 overflow-auto">
                              <pre>{typeof log.details === 'object' ? JSON.stringify(log.details, null, 2) : log.details}</pre>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8">
                  <Info className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No Logs Found</h3>
                  <p className="text-gray-500">Try adjusting your search or filters.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {logsData?.total > limit && (
            <div className="flex justify-between items-center mt-4">
              <div className="text-sm text-gray-500">
                Showing {Math.min((page - 1) * limit + 1, logsData.total)} to {Math.min(page * limit, logsData.total)} of {logsData.total} logs
              </div>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page * limit >= logsData.total}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
