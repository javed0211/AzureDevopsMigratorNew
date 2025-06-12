import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Clock, AlertCircle, Database } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function ExtractionOverview() {
  // Fetch extraction jobs from the API
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["/api/jobs"],
    refetchInterval: 5000,
  });

  const inProgressJobs = jobs.filter((job: any) => job.status === "in_progress");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Extraction Overview</h2>
        <Badge variant="outline">
          {inProgressJobs.length} {inProgressJobs.length === 1 ? 'Project' : 'Projects'} in Progress
        </Badge>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="work-items">Work Items</TabsTrigger>
          <TabsTrigger value="repositories">Repositories</TabsTrigger>
          <TabsTrigger value="test-cases">Test Cases</TabsTrigger>
          <TabsTrigger value="pipelines">Pipelines</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Database className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading extraction jobs...</span>
            </div>
          ) : jobs.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64">
                <Database className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Extraction Jobs</h3>
                <p className="text-gray-500 text-center">
                  Start by selecting projects in the Project Selection tab and begin extraction.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {jobs.map((job: any) => (
                <Card key={job.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {job.projectName || `Project ${job.projectId}`}
                      <Badge className={
                        job.status === 'completed' ? 'bg-green-100 text-green-800' :
                        job.status === 'in_progress' ? 'bg-orange-100 text-orange-800' :
                        job.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }>
                        {job.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                        {job.status === 'in_progress' && <Clock className="h-3 w-3 mr-1" />}
                        {job.status === 'failed' && <AlertCircle className="h-3 w-3 mr-1" />}
                        {job.status.charAt(0).toUpperCase() + job.status.slice(1).replace('_', ' ')}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Overall Progress</span>
                          <span>{job.progress || 0}%</span>
                        </div>
                        <Progress value={job.progress || 0} className="h-2" />
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-gray-500">Extracted Items</div>
                          <div className="font-medium">{job.extractedItems || 0} / {job.totalItems || 0}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Artifact Type</div>
                          <div className="font-medium">{job.artifactType || 'Mixed'}</div>
                        </div>
                      </div>
                      {job.startedAt && (
                        <div className="text-xs text-gray-500">
                          Started: {new Date(job.startedAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Mobile App Backend
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Completed
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Overall Progress</span>
                      <span>100%</span>
                    </div>
                    <Progress value={100} className="h-2" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500">Work Items</div>
                      <div className="font-medium">156 / 156</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Repositories</div>
                      <div className="font-medium">8 / 8</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Test Cases</div>
                      <div className="font-medium">45 / 45</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Pipelines</div>
                      <div className="font-medium">12 / 12</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Data Analytics Platform
                  <Badge className="bg-red-100 text-red-800">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Error
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Overall Progress</span>
                      <span>23%</span>
                    </div>
                    <Progress value={23} className="h-2" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500">Work Items</div>
                      <div className="font-medium">89 / 89</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Repositories</div>
                      <div className="font-medium text-red-600">Failed</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Test Cases</div>
                      <div className="font-medium">0 / 34</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Pipelines</div>
                      <div className="font-medium">0 / 8</div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full">
                    Retry Extraction
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="work-items">
          <Card>
            <CardHeader>
              <CardTitle>Work Items Extraction</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Work items extraction details will be displayed here.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="repositories">
          <Card>
            <CardHeader>
              <CardTitle>Repository Extraction</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Repository extraction details will be displayed here.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test-cases">
          <Card>
            <CardHeader>
              <CardTitle>Test Cases Extraction</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Test cases extraction details will be displayed here.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pipelines">
          <Card>
            <CardHeader>
              <CardTitle>Pipelines Extraction</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Pipelines extraction details will be displayed here.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
