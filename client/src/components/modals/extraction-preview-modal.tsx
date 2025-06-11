import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Download, GitBranch, FlaskConical, Settings2 } from "lucide-react";
import type { Project } from "@shared/schema";

interface ExtractionPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  project: Project | null;
}

export function ExtractionPreviewModal({ isOpen, onClose, onConfirm, project }: ExtractionPreviewModalProps) {
  if (!project) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Project Extraction Preview - {project.name}</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 my-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center">
              <CheckCircle className="text-blue-500 text-xl mr-3" />
              <div>
                <div className="text-sm font-medium text-gray-500">Work Items</div>
                <div className="text-2xl font-bold text-gray-900">{project.workItemCount}</div>
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center">
              <GitBranch className="text-green-500 text-xl mr-3" />
              <div>
                <div className="text-sm font-medium text-gray-500">Repositories</div>
                <div className="text-2xl font-bold text-gray-900">{project.repoCount}</div>
              </div>
            </div>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center">
              <FlaskConical className="text-purple-500 text-xl mr-3" />
              <div>
                <div className="text-sm font-medium text-gray-500">Test Cases</div>
                <div className="text-2xl font-bold text-gray-900">{project.testCaseCount}</div>
              </div>
            </div>
          </div>
          
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="flex items-center">
              <Settings2 className="text-orange-500 text-xl mr-3" />
              <div>
                <div className="text-sm font-medium text-gray-500">Pipelines</div>
                <div className="text-2xl font-bold text-gray-900">{project.pipelineCount}</div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onConfirm} className="bg-azure-blue hover:bg-azure-dark">
            <Download className="h-4 w-4 mr-2" />
            Confirm Extraction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
