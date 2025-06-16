import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { IterationPath, MigrationSummary } from "./types";

interface IterationPathsTabProps {
  iterationPaths: IterationPath[];
  summary: MigrationSummary;
  startExtraction: (artifactType: string) => Promise<void>;
}

export function IterationPathsTab({ iterationPaths, summary, startExtraction }: IterationPathsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Iteration Paths</CardTitle>
      </CardHeader>
      <CardContent>
        {iterationPaths.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No iteration paths have been extracted yet.</p>
            {!summary.extractionStatus.iterationPaths && (
              <Button className="mt-4" onClick={() => startExtraction("classification")}>
                Extract Classification
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Parent Path</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {iterationPaths.map((path) => (
                  <TableRow key={path.id}>
                    <TableCell>{path.name}</TableCell>
                    <TableCell>{path.path}</TableCell>
                    <TableCell>{path.parentPath || "-"}</TableCell>
                    <TableCell>{path.startDate || "-"}</TableCell>
                    <TableCell>{path.endDate || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}