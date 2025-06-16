import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AreaPath, MigrationSummary } from "./types";

interface AreaPathsTabProps {
  areaPaths: AreaPath[];
  summary: MigrationSummary;
  startExtraction: (artifactType: string) => Promise<void>;
}

export function AreaPathsTab({ areaPaths, summary, startExtraction }: AreaPathsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Area Paths</CardTitle>
      </CardHeader>
      <CardContent>
        {areaPaths.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No area paths have been extracted yet.</p>
            {!summary.extractionStatus.areaPaths && (
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {areaPaths.map((path) => (
                  <TableRow key={path.id}>
                    <TableCell>{path.name}</TableCell>
                    <TableCell>{path.path}</TableCell>
                    <TableCell>{path.parentPath || "-"}</TableCell>
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