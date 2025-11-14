// frontend/src/pages/GamesList.tsx - Refactored with custom hooks and utilities
import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getUserGames, getUser, deleteGame } from "../services/api";
import { getAnalysisStatus } from "../services/analysisApi";
import { usePagination } from "../hooks";
import { formatTimeControl, formatDate, getPlayerColor } from "../utils";
import type { User, Game } from "../types/api";

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
                            onClick={() => alert("Game viewer coming in Step 4!")}
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

      <style>{`
        /* Same styles as before - keeping them for now */
        .games-list {
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
        }

        .page-header {
          margin-bottom: 30px;
        }

        .header-main {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .header-main h1 {
          margin: 0;
          color: #333;
        }

        .primary-button {
          background: #007bff;
          color: white;
          padding: 10px 20px;
          text-decoration: none;
          border-radius: 4px;
          border: none;
          cursor: pointer;
          font-size: 1em;
        }

        .primary-button:hover {
          background: #0056b3;
        }

        .games-stats {
          display: flex;
          gap: 20px;
          color: #666;
          font-size: 0.875rem;
        }

        .stat {
          font-size: 0.9em;
        }

        .alert {
          padding: 15px;
          margin-bottom: 20px;
          border-radius: 4px;
        }

        .alert.error {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }

        .alert.success {
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }

        .empty-state {
          text-align: center;
          padding: 40px;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .empty-state h3 {
          margin: 0 0 10px 0;
          color: #333;
        }

        .empty-state p {
          margin: 10px 0;
          color: #666;
        }

        .games-table-container {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          margin-bottom: 2rem;
          overflow-x: auto;
        }

        .games-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 900px;
        }

        .games-table th,
        .games-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #ddd;
          vertical-align: top;
        }

        .games-table th {
          background: #f8f9fa;
          font-weight: bold;
          color: #333;
        }

        .games-table tr:hover {
          background: #f8f9fa;
        }

        .date-cell small {
          color: #666;
          font-size: 0.8em;
        }

        .opponent-cell strong {
          color: #333;
        }

        .opponent-cell small {
          color: #666;
          font-size: 0.8em;
        }

        .result-cell {
          text-align: center;
        }

        .result-cell.win .result-badge {
          background: #28a745;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.9em;
        }

        .result-cell.loss .result-badge {
          background: #dc3545;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.9em;
        }

        .result-cell.draw .result-badge {
          background: #6c757d;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.9em;
        }

        .raw-result {
          color: #666;
          font-size: 0.8em;
        }

        .time-control-cell {
          text-align: center;
          font-weight: 500;
        }

        .ratings-cell {
          text-align: center;
        }

        .rating-pair {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .user-rating {
          font-weight: 500;
          color: #333;
        }

        .opponent-rating {
          color: #666;
          font-size: 0.8em;
        }

        .analysis-cell {
          text-align: center;
        }

        .analysis-status {
          font-size: 0.8em;
          padding: 2px 6px;
          border-radius: 12px;
          font-weight: 500;
        }

        .analysis-status.analyzing {
          background: #fff3cd;
          color: #856404;
        }

        .analysis-status.complete {
          background: #d4edda;
          color: #155724;
        }

        .analysis-status.none {
          background: #f8f9fa;
          color: #6c757d;
        }

        .actions-cell {
          text-align: center;
        }

        .action-buttons {
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .action-button {
          padding: 4px 8px;
          border: none;
          border-radius: 3px;
          cursor: pointer;
          font-size: 0.8em;
          transition: all 0.2s;
        }

        .action-button.view {
          background: #17a2b8;
          color: white;
        }

        .action-button.analyze {
          background: #28a745;
          color: white;
        }

        .action-button.analyze.analyzed {
          background: #6f42c1;
          color: white;
        }

        .action-button.delete {
          background: #dc3545;
          color: white;
        }

        .action-button:hover:not(:disabled) {
          opacity: 0.8;
          transform: translateY(-1px);
        }

        .action-button:disabled {
          background: #6c757d;
          cursor: not-allowed;
          opacity: 0.6;
        }

        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 20px;
          margin-top: 20px;
        }

        .pagination-button {
          padding: 10px 20px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 4px;
          cursor: pointer;
        }

        .pagination-button:disabled {
          background: #f5f5f5;
          color: #999;
          cursor: not-allowed;
        }

        .pagination-button:hover:not(:disabled) {
          background: #f8f9fa;
        }

        .pagination-info {
          color: #666;
          font-weight: 500;
        }

        .loading-overlay {
          text-align: center;
          padding: 20px;
          color: #666;
        }

        .loading {
          text-align: center;
          padding: 40px;
          color: #666;
        }

        .error {
          text-align: center;
          padding: 40px;
          color: #dc3545;
        }

        .error h2 {
          margin-bottom: 10px;
        }

        @media (max-width: 768px) {
          .games-list {
            padding: 10px;
          }

          .header-main {
            flex-direction: column;
            text-align: center;
          }

          .action-buttons {
            flex-direction: column;
            gap: 3px;
          }

          .action-button {
            font-size: 0.7em;
            padding: 3px 6px;
          }
        }
      `}</style>
    </div>
  );
};

export default GamesList;
