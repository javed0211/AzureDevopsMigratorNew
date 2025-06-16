import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MigrationSummary } from "./types";

interface SummaryTabProps {
  summary: MigrationSummary;
  startExtraction: (artifactType: string) => Promise<void>;
}

export function SummaryTab({ summary, startExtraction }: SummaryTabProps) {
  const readinessScore = Object.values(summary.migrationReadiness).filter(Boolean).length;
  const totalReadinessItems = Object.keys(summary.migrationReadiness).length;
  const readinessPercentage = Math.round((readinessScore / totalReadinessItems) * 100);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Migration Readiness</CardTitle>
          <CardDescription>Overall readiness for migration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              <span>Readiness Score</span>
              <span>{readinessScore}/{totalReadinessItems}</span>
            </div>
            <Progress value={readinessPercentage} className="h-2" />
          </div>

          <div className="space-y-2">
            {Object.entries(summary.migrationReadiness).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center">
                <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                {value ? (
                  <Badge variant="default" className="bg-green-500">Ready</Badge>
                ) : (
                  <Badge variant="destructive">Not Ready</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Extraction Status</CardTitle>
          <CardDescription>Status of data extraction</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Classification (Area/Iteration Paths)</span>
              {summary.extractionStatus.areaPaths && summary.extractionStatus.iterationPaths ? (
                <Badge variant="default" className="bg-green-500">Extracted</Badge>
              ) : (
                <Button size="sm" onClick={() => startExtraction("classification")}>Extract</Button>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span>Work Items</span>
              {summary.extractionStatus.workItems ? (
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-green-500">Extracted</Badge>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-800"
                    onClick={() => {
                      // Extract the project ID from the current URL
                      const url = window.location.href;
                      const match = url.match(/\/projects\/(\d+)/);
                      if (match && match[1]) {
                        const projectId = match[1];
                        // Navigate to the work-items page
                        window.location.href = `/projects/${projectId}/work-items`;
                      }
                    }}
                  >
                    View Work Items
                  </Button>
                </div>
              ) : (
                <Button size="sm" onClick={() => startExtraction("workitems")}>Extract</Button>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span>Repositories</span>
              {summary.extractionStatus.repositories ? (
                <Badge variant="default" className="bg-green-500">Extracted</Badge>
              ) : (
                <Button size="sm" onClick={() => startExtraction("repositories")}>Extract</Button>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span>Pipelines</span>
              {summary.extractionStatus.pipelines ? (
                <Badge variant="default" className="bg-green-500">Extracted</Badge>
              ) : (
                <Button size="sm" onClick={() => startExtraction("pipelines")}>Extract</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Extracted Data Counts</CardTitle>
          <CardDescription>Summary of extracted data entities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-100 p-4 rounded-lg">
              <div className="text-3xl font-bold">{summary.counts.workItems}</div>
              <div className="text-sm text-gray-500">Work Items</div>
            </div>
            <div className="bg-gray-100 p-4 rounded-lg">
              <div className="text-3xl font-bold">{summary.counts.revisions}</div>
              <div className="text-sm text-gray-500">Revisions</div>
            </div>
            <div className="bg-gray-100 p-4 rounded-lg">
              <div className="text-3xl font-bold">{summary.counts.comments}</div>
              <div className="text-sm text-gray-500">Comments</div>
            </div>
            <div className="bg-gray-100 p-4 rounded-lg">
              <div className="text-3xl font-bold">{summary.counts.attachments}</div>
              <div className="text-sm text-gray-500">Attachments</div>
            </div>
            <div className="bg-gray-100 p-4 rounded-lg">
              <div className="text-3xl font-bold">{summary.counts.relations}</div>
              <div className="text-sm text-gray-500">Relations</div>
            </div>
            <div className="bg-gray-100 p-4 rounded-lg">
              <div className="text-3xl font-bold">{summary.counts.repositories}</div>
              <div className="text-sm text-gray-500">Repositories</div>
            </div>
            <div className="bg-gray-100 p-4 rounded-lg">
              <div className="text-3xl font-bold">{summary.counts.areaPaths}</div>
              <div className="text-sm text-gray-500">Area Paths</div>
            </div>
            <div className="bg-gray-100 p-4 rounded-lg">
              <div className="text-3xl font-bold">{summary.counts.iterationPaths}</div>
              <div className="text-sm text-gray-500">Iteration Paths</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}