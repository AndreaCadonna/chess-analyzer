// frontend/src/pages/ImportPage.tsx - Refactored with utilities
import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  getUser,
  importUserGames,
  validateChessComUsername,
  getImportHistory,
} from "../services/api";
import { formatDate, formatRelativeDate } from "../utils";
import { prepareImportOptions } from "../utils/importValidation";
import type { User, ImportResult } from "../types/api";
import "./ImportPage.css";

interface ImportHistory {
  totalGames: number;
  lastImport?: string;
  recentGames?: Array<{
    id: string;
    whitePlayer: string;
    blackPlayer: string;
    result: string;
    playedAt: string;
  }>;
  user: {
    id: string;
    chessComUsername: string;
    gameCount: number;
  };
}

const ImportPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();

  // Core state
  const [user, setUser] = useState<User | null>(null);
  const [importHistory, setImportHistory] = useState<ImportHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [importOptions, setImportOptions] = useState({
    startDate: "",
    endDate: "",
    maxGames: "",
  });

  // Progress state
  const [importProgress, setImportProgress] = useState<{
    percentage: number;
    message: string;
    status: string;
  } | null>(null);

  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Load user data and import history
  const loadUserData = useCallback(async () => {
    if (!userId) {
      setError("No user ID provided");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const userData = await getUser(userId);
      setUser(userData);

      // Try to load import history (non-critical)
      try {
        const historyData = await getImportHistory(userId);
        setImportHistory(historyData);
      } catch (historyError) {
        console.warn("Failed to load import history:", historyError);
        setImportHistory({
          totalGames: 0,
          recentGames: [],
          user: {
            id: userData.id,
            chessComUsername: userData.chessComUsername,
            gameCount: userData.gameCount || 0,
          },
        });
      }
    } catch (err) {
      console.error("Error loading user data:", err);
      setError(err instanceof Error ? err.message : "Failed to load user data");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // Handle import submission
  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setImporting(true);
      setError(null);
      setSuccess(null);
      setImportProgress({
        percentage: 0,
        message: "Starting import...",
        status: "starting",
      });

      // Validate Chess.com username
      const isValid = await validateChessComUsername(user.chessComUsername);
      if (!isValid) {
        throw new Error(`Chess.com user '${user.chessComUsername}' not found`);
      }

      // Prepare and validate options
      const options = prepareImportOptions(importOptions);

      // Start import
      const result = await importUserGames(userId!, options);

      setImportResult(result.importResult);
      setSuccess(
        `Import completed! ${result.importResult.totalImported} games imported, ${result.importResult.totalSkipped} skipped.`
      );

      // Update progress with final status
      if (result.progress.length > 0) {
        const finalProgress = result.progress[result.progress.length - 1] as {
          percentage: number;
          message: string;
          status: string;
        };
        setImportProgress(finalProgress);
      }

      // Reload user data
      await loadUserData();
    } catch (err) {
      console.error("Import error:", err);
      const errorMessage = err instanceof Error ? err.message : "Import failed";
      setError(errorMessage);
      setImportProgress({
        percentage: 0,
        message: errorMessage,
        status: "error",
      });
    } finally {
      setImporting(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setImportOptions({ startDate: "", endDate: "", maxGames: "" });
    setImportProgress(null);
    setImportResult(null);
    setError(null);
    setSuccess(null);
  };

  // Loading state
  if (loading) {
    return (
      <div className="import-page">
        <div className="loading">Loading user data...</div>
      </div>
    );
  }

  // Error state
  if (error && !user) {
    return (
      <div className="import-page">
        <div className="error">
          <h2>Error</h2>
          <p>{error}</p>
          <p>User ID: {userId}</p>
        </div>
      </div>
    );
  }

  // No user state
  if (!user) {
    return (
      <div className="import-page">
        <div className="error">User not found</div>
      </div>
    );
  }

  return (
    <div className="import-page">
      {/* Header */}
      <div className="import-header">
        <h1>Import Games for {user.chessComUsername}</h1>
        <p>Import your chess games from Chess.com for analysis</p>
      </div>

      {/* User Stats */}
      <div className="user-stats">
        <div className="stat">
          <span className="stat-label">Total Games:</span>
          <span className="stat-value">
            {importHistory?.totalGames || user.gameCount || 0}
          </span>
        </div>
        {importHistory?.lastImport && (
          <div className="stat">
            <span className="stat-label">Last Import:</span>
            <span className="stat-value">{formatRelativeDate(importHistory.lastImport)}</span>
          </div>
        )}
      </div>

      {/* Recent Games Preview */}
      {importHistory?.recentGames && importHistory.recentGames.length > 0 && (
        <div className="recent-games">
          <h3>Recent Games</h3>
          <div className="games-list">
            {importHistory.recentGames.map((game) => (
              <div key={game.id} className="game-item">
                <span className="players">
                  {game.whitePlayer} vs {game.blackPlayer}
                </span>
                <span className="result">{game.result}</span>
                <span className="date">{formatDate(game.playedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No games message */}
      {importHistory && importHistory.totalGames === 0 && (
        <div className="no-games-message">
          <h3>No games imported yet</h3>
          <p>
            This user hasn't imported any games. Use the form below to start
            importing games from Chess.com.
          </p>
        </div>
      )}

      {/* Import Form */}
      <div className="import-section">
        <h2>Import New Games</h2>

        <form onSubmit={handleImport} className="import-form">
          <div className="form-group">
            <label htmlFor="startDate">Start Date (optional):</label>
            <input
              type="date"
              id="startDate"
              value={importOptions.startDate}
              onChange={(e) =>
                setImportOptions({ ...importOptions, startDate: e.target.value })
              }
              disabled={importing}
            />
            <small>Leave empty to import from 3 months ago</small>
          </div>

          <div className="form-group">
            <label htmlFor="endDate">End Date (optional):</label>
            <input
              type="date"
              id="endDate"
              value={importOptions.endDate}
              onChange={(e) =>
                setImportOptions({ ...importOptions, endDate: e.target.value })
              }
              disabled={importing}
            />
            <small>Leave empty to import until today</small>
          </div>

          <div className="form-group">
            <label htmlFor="maxGames">Max Games (optional):</label>
            <input
              type="number"
              id="maxGames"
              min="1"
              max="1000"
              value={importOptions.maxGames}
              onChange={(e) =>
                setImportOptions({ ...importOptions, maxGames: e.target.value })
              }
              disabled={importing}
              placeholder="Leave empty to import all"
            />
            <small>Maximum number of games to import (1-1000)</small>
          </div>

          <div className="form-actions">
            <button type="submit" disabled={importing} className="import-button primary">
              {importing ? "Importing..." : "Start Import"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              disabled={importing}
              className="reset-button secondary"
            >
              Reset
            </button>
          </div>
        </form>

        {/* Progress Display */}
        {importProgress && (
          <div className="import-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${importProgress.percentage}%` }}
              />
            </div>
            <div className="progress-text">
              {importProgress.message} ({importProgress.percentage}%)
            </div>
          </div>
        )}

        {/* Alerts */}
        {error && (
          <div className="alert error">
            <strong>Error:</strong> {error}
          </div>
        )}
        {success && (
          <div className="alert success">
            <strong>Success:</strong> {success}
          </div>
        )}

        {/* Import Results */}
        {importResult && (
          <div className="import-results">
            <h3>Import Results</h3>
            <div className="results-grid">
              <div className="result-item">
                <span className="result-label">Fetched:</span>
                <span className="result-value">{importResult.totalFetched}</span>
              </div>
              <div className="result-item">
                <span className="result-label">Imported:</span>
                <span className="result-value">{importResult.totalImported}</span>
              </div>
              <div className="result-item">
                <span className="result-label">Skipped:</span>
                <span className="result-value">{importResult.totalSkipped}</span>
              </div>
              <div className="result-item">
                <span className="result-label">Duration:</span>
                <span className="result-value">
                  {Math.round(importResult.duration / 1000)}s
                </span>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="import-errors">
                <h4>Errors:</h4>
                <ul>
                  {importResult.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};

export default ImportPage;
