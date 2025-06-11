import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Search, AlertCircle, Info, AlertTriangle } from "lucide-react";

export default function AuditLogs() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Audit & Logs</h2>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Logs
        </Button>
      </div>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="logs">Detailed Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Info className="text-blue-500 text-xl mr-3" />
                  <div>
                    <div className="text-sm font-medium text-gray-500">Total Operations</div>
                    <div className="text-2xl font-bold text-gray-900">1,247</div>
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
                    <div className="text-2xl font-bold text-gray-900">23</div>
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
                    <div className="text-2xl font-bold text-gray-900">5</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Download className="text-green-500 text-xl mr-3" />
                  <div>
                    <div className="text-sm font-medium text-gray-500">Success Rate</div>
                    <div className="text-2xl font-bold text-gray-900">99.6%</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertCircle className="text-red-500 mr-2" />
                Repository Clone Failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-sm text-gray-600">
                  <strong>Project:</strong> Data Analytics Platform
                </div>
                <div className="text-sm text-gray-600">
                  <strong>Time:</strong> 2024-01-15 14:32:15
                </div>
                <div className="text-sm text-red-600">
                  <strong>Error:</strong> Failed to clone repository 'analytics-core' - Authentication failed
                </div>
                <Button size="sm" variant="outline">
                  Retry Operation
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="text-orange-500 mr-2" />
                Work Item Field Mapping
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-sm text-gray-600">
                  <strong>Project:</strong> Customer Portal v2
                </div>
                <div className="text-sm text-gray-600">
                  <strong>Time:</strong> 2024-01-15 13:45:22
                </div>
                <div className="text-sm text-orange-600">
                  <strong>Warning:</strong> Custom field 'BusinessValue' not found in target process template
                </div>
                <Button size="sm" variant="outline">
                  Review Mapping
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Migration Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">Mobile App Backend - Migration Completed</div>
                    <div className="text-xs text-gray-500">2024-01-15 15:45:30</div>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Completed</Badge>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">Customer Portal v2 - Extraction In Progress</div>
                    <div className="text-xs text-gray-500">2024-01-15 14:20:15</div>
                  </div>
                  <Badge className="bg-orange-100 text-orange-800">In Progress</Badge>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">Data Analytics Platform - Repository Clone Failed</div>
                    <div className="text-xs text-gray-500">2024-01-15 14:32:15</div>
                  </div>
                  <Badge className="bg-red-100 text-red-800">Failed</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <Input placeholder="Search logs..." className="w-full" />
            </div>
            <Select defaultValue="all">
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
            <Button variant="outline">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-200">
                <div className="p-4 hover:bg-gray-50">
                  <div className="flex items-start space-x-3">
                    <Info className="text-blue-500 mt-1" size={16} />
                    <div className="flex-1">
                      <div className="text-sm">
                        <span className="text-gray-500">2024-01-15 15:45:30</span>
                        <span className="mx-2">|</span>
                        <span className="font-medium">Mobile App Backend</span>
                        <span className="mx-2">|</span>
                        Migration completed successfully - 156 work items, 8 repositories, 45 test cases, 12 pipelines migrated
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 hover:bg-gray-50">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="text-orange-500 mt-1" size={16} />
                    <div className="flex-1">
                      <div className="text-sm">
                        <span className="text-gray-500">2024-01-15 14:32:15</span>
                        <span className="mx-2">|</span>
                        <span className="font-medium">Customer Portal v2</span>
                        <span className="mx-2">|</span>
                        Warning: Custom field 'BusinessValue' not found in target process template, using default mapping
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 hover:bg-gray-50">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="text-red-500 mt-1" size={16} />
                    <div className="flex-1">
                      <div className="text-sm">
                        <span className="text-gray-500">2024-01-15 14:32:15</span>
                        <span className="mx-2">|</span>
                        <span className="font-medium">Data Analytics Platform</span>
                        <span className="mx-2">|</span>
                        Error: Failed to clone repository 'analytics-core' - Authentication failed (401 Unauthorized)
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
