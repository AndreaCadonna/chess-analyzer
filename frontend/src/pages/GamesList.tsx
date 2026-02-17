// frontend/src/pages/GamesList.tsx - Refactored with custom hooks and utilities
import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getUserGames, getUser, deleteGame } from "../services/api";
import { getAnalysisStatus } from "../services/analysisApi";
import { usePagination } from "../hooks";
import { formatTimeControl, formatDate, getPlayerColor } from "../utils";
import type { User, Game } from "../types/api";
import "./GamesList.css";

const GAMES_PER_PAGE = 20;

const GamesList: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  // Core state
  const [user, setUser] = useState<User | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [totalGames, setTotalGames] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Analysis status tracking
  const [analysisStatus, setAnalysisStatus] = useState<
    Record<string, { hasAnalysis: boolean; isAnalyzing: boolean }>
  >({});

  // Pagination using custom hook
  const pagination = usePagination({ itemsPerPage: GAMES_PER_PAGE });

  // Load analysis status for games
  const loadAnalysisStatus = useCallback(async (gamesArray: Game[]) => {
    const statusMap: Record<string, { hasAnalysis: boolean; isAnalyzing: boolean }> = {};

    try {
      const statusPromises = gamesArray.map(async (game) => {
        try {
          const status = await getAnalysisStatus(game.id);
          return {
            gameId: game.id,
            hasAnalysis: status.hasExistingAnalysis,
            isAnalyzing: status.isAnalyzing,
          };
        } catch (error) {
          console.warn(`Failed to get analysis status for game ${game.id}:`, error);
          return { gameId: game.id, hasAnalysis: false, isAnalyzing: false };
        }
      });

      const results = await Promise.all(statusPromises);
      results.forEach((result) => {
        statusMap[result.gameId] = {
          hasAnalysis: result.hasAnalysis,
          isAnalyzing: result.isAnalyzing,
        };
      });

      setAnalysisStatus(statusMap);
    } catch (error) {
      console.error("Error loading analysis status:", error);
    }
  }, []);

  // Load user and games
  const loadUserAndGames = useCallback(async () => {
    if (!userId) {
      setError("No user ID provided");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [userData, gamesData] = await Promise.all([
        getUser(userId),
        getUserGames(userId, pagination.itemsPerPage, pagination.offset),
      ]);

      setUser(userData);
      const gamesArray = Array.isArray(gamesData.games) ? gamesData.games : [];
      setGames(gamesArray);
      setTotalGames(gamesData.pagination?.total || 0);

      await loadAnalysisStatus(gamesArray);
    } catch (err) {
      console.error("Error loading user and games:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [userId, pagination.offset, pagination.itemsPerPage, loadAnalysisStatus]);

  useEffect(() => {
    if (!userId) return;
    loadUserAndGames();
  }, [userId, pagination.currentPage, loadUserAndGames]);

  // Delete game handler
  const handleDeleteGame = async (gameId: string, gameInfo: string) => {
    if (!confirm(`Are you sure you want to delete the game: ${gameInfo}?`)) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      await deleteGame(gameId);
      setSuccess("Game deleted successfully");
      await loadUserAndGames();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete game");
    }
  };

  // Navigate to analysis
  const handleAnalyzeGame = (gameId: string) => {
    navigate(`/analysis/${gameId}`);
  };

  // Get result display for user's perspective
  const getResultForUser = (game: Game, username: string): { text: string; className: string } => {
    const playerColor = getPlayerColor(game, username);
    if (!playerColor) return { text: 'Unknown', className: 'unknown' };

    if (game.result === '1-0') {
      return playerColor === 'white'
        ? { text: 'Win', className: 'win' }
        : { text: 'Loss', className: 'loss' };
    } else if (game.result === '0-1') {
      return playerColor === 'white'
        ? { text: 'Loss', className: 'loss' }
        : { text: 'Win', className: 'win' };
    } else {
      return { text: 'Draw', className: 'draw' };
    }
  };

  // Loading state
  if (loading && pagination.currentPage === 0) {
    return (
      <div className="games-list">
        <div className="loading">Loading games...</div>
      </div>
    );
  }

  // Error state
  if (error && !user) {
    return (
      <div className="games-list">
        <div className="error">
          <h2>Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // No user state
  if (!user) {
    return (
      <div className="games-list">
        <div className="error">User not found</div>
      </div>
    );
  }

  return (
    <div className="games-list">
      {/* Header */}
      <div className="page-header">
        <div className="header-main">
          <h1>Games for {user.chessComUsername}</h1>
          <Link to={`/import/${user.id}`} className="primary-button">
            Import More Games
          </Link>
        </div>
        <div className="games-stats">
          <span className="stat">Total Games: {totalGames}</span>
          <span className="stat">Showing: {games.length}</span>
        </div>
      </div>

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

      {/* Games Table or Empty State */}
      {!Array.isArray(games) || games.length === 0 ? (
        <div className="empty-state">
          <h3>No games found</h3>
          <p>This user hasn't imported any games yet.</p>
          <Link to={`/import/${user.id}`} className="primary-button">
            Import Games Now
          </Link>
        </div>
      ) : (
        <>
          <div className="games-table-container">
            <table className="games-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Opponent</th>
                  <th>Result</th>
                  <th>Time Control</th>
                  <th>Ratings</th>
                  <th>Analysis</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {games.map((game) => {
                  const playerColor = getPlayerColor(game, user.chessComUsername);
                  const opponent = playerColor === 'white' ? game.blackPlayer : game.whitePlayer;
                  const userRating = playerColor === 'white' ? game.whiteRating : game.blackRating;
                  const opponentRating = playerColor === 'white' ? game.blackRating : game.whiteRating;
                  const result = getResultForUser(game, user.chessComUsername);
                  const gameAnalysisStatus = analysisStatus[game.id] || {
                    hasAnalysis: false,
                    isAnalyzing: false,
                  };

                  return (
                    <tr key={game.id}>
                      <td className="date-cell">
                        {formatDate(game.playedAt)}
                        <br />
                        <small>{new Date(game.playedAt).toLocaleTimeString()}</small>
                      </td>

                      <td className="opponent-cell">
                        <strong>{opponent}</strong>
                        <br />
                        <small>(as {playerColor === 'white' ? 'White' : 'Black'})</small>
                      </td>

                      <td className={`result-cell ${result.className}`}>
                        <span className="result-badge">{result.text}</span>
                        <br />
                        <small className="raw-result">{game.result}</small>
                      </td>

                      <td className="time-control-cell">
                        {formatTimeControl(game.timeControl)}
                      </td>

                      <td className="ratings-cell">
                        <div className="rating-pair">
                          <span className="user-rating">You: {userRating || "Unrated"}</span>
                          <span className="opponent-rating">Opp: {opponentRating || "Unrated"}</span>
                        </div>
                      </td>

                      <td className="analysis-cell">
                        {gameAnalysisStatus.isAnalyzing ? (
                          <span className="analysis-status analyzing">🔄 Analyzing...</span>
                        ) : gameAnalysisStatus.hasAnalysis ? (
                          <span className="analysis-status complete">✅ Complete</span>
                        ) : (
                          <span className="analysis-status none">⚪ Not analyzed</span>
                        )}
                      </td>

                      <td className="actions-cell">
                        <div className="action-buttons">
                          <button
                            className="action-button view"
                            onClick={() => navigate(`/analysis/${game.id}`)}
                          >
                            View
                          </button>

                          <button
                            className={`action-button analyze ${
                              gameAnalysisStatus.hasAnalysis ? "analyzed" : ""
                            }`}
                            onClick={() => handleAnalyzeGame(game.id)}
                            disabled={gameAnalysisStatus.isAnalyzing}
                          >
                            {gameAnalysisStatus.hasAnalysis
                              ? "View Analysis"
                              : gameAnalysisStatus.isAnalyzing
                              ? "Analyzing..."
                              : "Analyze"}
                          </button>

                          <button
                            className="action-button delete"
                            onClick={() =>
                              handleDeleteGame(
                                game.id,
                                `${game.whitePlayer} vs ${game.blackPlayer}`
                              )
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination">
            <button
              onClick={pagination.prevPage}
              disabled={!pagination.hasPrev() || loading}
              className="pagination-button"
            >
              Previous
            </button>

            <span className="pagination-info">
              Page {pagination.currentPage + 1} of {pagination.totalPages(totalGames)}
            </span>

            <button
              onClick={pagination.nextPage}
              disabled={!pagination.hasNext(totalGames) || loading}
              className="pagination-button"
            >
              Next
            </button>
          </div>

          {loading && <div className="loading-overlay">Loading more games...</div>}
        </>
      )}

    </div>
  );
};

export default GamesList;
