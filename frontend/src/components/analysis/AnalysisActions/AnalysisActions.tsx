// src/components/analysis/AnalysisActions/AnalysisActions.tsx
import React from "react";
import Button from "../../ui/Button";
import Modal from "../../ui/Modal";
import Alert from "../../ui/Alert";
import ProgressBar from "../../ui/ProgressBar/ProgressBar";
import type { StreamProgress } from "../../../services/analysisApi";
import "./AnalysisActions.css";

interface AnalysisActionsProps {
  /**
   * Whether analysis exists for this game
   */
  hasAnalysis: boolean;

  /**
   * Whether analysis is currently running
   */
  isAnalyzing: boolean;

  /**
   * Handler for starting new analysis
   */
  onStartNewAnalysis: () => void;

  /**
   * Handler for deleting existing analysis
   */
  onDeleteAnalysis: () => void;

  /**
   * Handler for switching to variation explorer mode
   */
  onOpenVariationExplorer?: () => void;

  /**
   * Handler for exporting analysis data
   */
  onExportAnalysis?: () => void;

  /**
   * Whether variation explorer is available
   */
  variationExplorerAvailable?: boolean;

  /**
   * Real-time analysis progress from streaming
   */
  analysisProgress?: StreamProgress | null;

  /**
   * Additional CSS classes
   */
  className?: string;
}

export const AnalysisActions: React.FC<AnalysisActionsProps> = ({
  hasAnalysis,
  isAnalyzing,
  onStartNewAnalysis,
  onDeleteAnalysis,
  onOpenVariationExplorer,
  onExportAnalysis,
  analysisProgress,
  variationExplorerAvailable = false,
  className = "",
}) => {
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [showNewAnalysisModal, setShowNewAnalysisModal] = React.useState(false);

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = () => {
    onDeleteAnalysis();
    setShowDeleteModal(false);
  };

  const handleNewAnalysisClick = () => {
    if (hasAnalysis) {
      setShowNewAnalysisModal(true);
    } else {
      onStartNewAnalysis();
    }
  };

  const handleNewAnalysisConfirm = () => {
    onStartNewAnalysis();
    setShowNewAnalysisModal(false);
  };

  if (!hasAnalysis && !isAnalyzing) {
    return null; // Let the main analysis form handle the initial analysis case
  }

  return (
    <div className={`analysis-actions ${className}`}>
      <div className="analysis-actions__header">
        <h3 className="analysis-actions__title">🛠️ Analysis Tools</h3>

        <div className="analysis-actions__status">
          {hasAnalysis && (
            <span className="status-badge status-badge--success">
              ✅ Analysis Complete
            </span>
          )}

          {isAnalyzing && !analysisProgress && (
            <span className="status-badge status-badge--analyzing">
              🔄 Starting...
            </span>
          )}
          {isAnalyzing && analysisProgress && (
            <span className="status-badge status-badge--analyzing">
              🔄 Analyzing...
            </span>
          )}
        </div>
      </div>

      {isAnalyzing && analysisProgress && (
        <div className="analysis-progress">
          <ProgressBar
            value={analysisProgress.current}
            max={analysisProgress.total}
            variant="bar"
            animated
            striped
            showPercentage
            showProgress
            label={analysisProgress.message}
          />
        </div>
      )}

      <div className="analysis-actions__grid">
        {/* Primary Actions */}
        <div className="action-group action-group--primary">
          <h4 className="action-group__title">Primary Actions</h4>

          <div className="action-buttons">
            <Button
              variant="primary"
              size="md"
              onClick={handleNewAnalysisClick}
              disabled={isAnalyzing}
              fullWidth
            >
              {hasAnalysis ? "Re-analyze Game" : "Start Analysis"}
            </Button>

            {variationExplorerAvailable && onOpenVariationExplorer && (
              <Button
                variant="outline"
                size="md"
                onClick={onOpenVariationExplorer}
                disabled={!hasAnalysis || isAnalyzing}
                fullWidth
                leftIcon={<span>🧪</span>}
              >
                Explore Variations
              </Button>
            )}
          </div>
        </div>

        {/* Secondary Actions */}
        {hasAnalysis && (
          <div className="action-group action-group--secondary">
            <h4 className="action-group__title">Data Actions</h4>

            <div className="action-buttons">
              {onExportAnalysis && (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={onExportAnalysis}
                  disabled={isAnalyzing}
                  fullWidth
                  leftIcon={<span>📊</span>}
                >
                  Export Analysis
                </Button>
              )}

              <Button
                variant="danger"
                size="md"
                onClick={handleDeleteClick}
                disabled={isAnalyzing}
                fullWidth
                leftIcon={<span>🗑️</span>}
              >
                Delete Analysis
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions Info */}
      <div className="analysis-actions__info">
        <Alert variant="info" hideIcon>
          <strong>💡 Tip:</strong> Use keyboard shortcuts:
          <kbd>←</kbd>/<kbd>→</kbd> to navigate moves,
          <kbd>Home</kbd>/<kbd>End</kbd> for start/end position.
        </Alert>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Analysis"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowDeleteModal(false)}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm}>
              Delete Analysis
            </Button>
          </>
        }
      >
        <div className="delete-modal-content">
          <Alert variant="warning" hideIcon>
            <strong>Warning:</strong> This action cannot be undone.
          </Alert>

          <p>
            Are you sure you want to delete the analysis for this game? This
            will permanently remove:
          </p>

          <ul className="delete-items-list">
            <li>All move evaluations and best moves</li>
            <li>Mistake classifications and accuracy data</li>
            <li>Analysis depth and timing information</li>
          </ul>

          <p>
            You can always re-analyze the game later, but it will take time to
            process again.
          </p>
        </div>
      </Modal>

      {/* New Analysis Confirmation Modal */}
      <Modal
        isOpen={showNewAnalysisModal}
        onClose={() => setShowNewAnalysisModal(false)}
        title="Re-analyze Game"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowNewAnalysisModal(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleNewAnalysisConfirm}>
              Start New Analysis
            </Button>
          </>
        }
      >
        <div className="new-analysis-modal-content">
          <Alert variant="info" hideIcon>
            <strong>Note:</strong> This will replace the existing analysis.
          </Alert>

          <p>Starting a new analysis will:</p>

          <ul className="analysis-items-list">
            <li>Override current analysis results</li>
            <li>Use updated engine settings and depth</li>
            <li>May produce different evaluations</li>
            <li>Take several minutes to complete</li>
          </ul>

          <p>
            The existing analysis will be replaced once the new analysis is
            complete.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default AnalysisActions;
