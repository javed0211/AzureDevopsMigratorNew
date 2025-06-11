import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Clock, AlertCircle } from "lucide-react";

export default function ExtractionOverview() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Extraction Overview</h2>
        <Badge variant="outline">3 Projects in Progress</Badge>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Customer Portal v2
                  <Badge className="bg-orange-100 text-orange-800">
                    <Clock className="h-3 w-3 mr-1" />
                    Extracting
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Overall Progress</span>
                      <span>65%</span>
                    </div>
                    <Progress value={65} className="h-2" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500">Work Items</div>
                      <div className="font-medium">247 / 247</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Repositories</div>
                      <div className="font-medium">8 / 12</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Test Cases</div>
                      <div className="font-medium">45 / 89</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Pipelines</div>
                      <div className="font-medium">12 / 15</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
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
