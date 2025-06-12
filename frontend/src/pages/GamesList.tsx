// frontend/src/pages/GamesList.tsx - Complete updated version with analysis functionality
import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getUserGames, getUser, deleteGame } from "../services/api";
import { getAnalysisStatus } from "../services/analysisApi"; // 🆕 New import
import type { User, Game } from "../types/api";

const GamesList: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Analysis status tracking
  const [analysisStatus, setAnalysisStatus] = useState<
    Record<
      string,
      {
        hasAnalysis: boolean;
        isAnalyzing: boolean;
      }
    >
  >({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalGames, setTotalGames] = useState(0);
  const gamesPerPage = 20;

  // 🆕 Load analysis status for games
  const loadAnalysisStatus = useCallback(async (gamesArray: Game[]) => {
    const statusMap: Record<
      string,
      { hasAnalysis: boolean; isAnalyzing: boolean }
    > = {};

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
          console.warn(
            `Failed to get analysis status for game ${game.id}:`,
            error
          );
          return {
            gameId: game.id,
            hasAnalysis: false,
            isAnalyzing: false,
          };
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

  const loadUserAndGames = useCallback(async () => {
    if (!userId) {
      setError("No user ID provided");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log("Loading user and games for userId:", userId);

      // Load user data and games in parallel
      const [userData, gamesData] = await Promise.all([
        getUser(userId),
        getUserGames(userId, gamesPerPage, currentPage * gamesPerPage),
      ]);

      console.log("User data loaded:", userData);
      console.log("Games data loaded:", gamesData);

      setUser(userData);

      // Safety check: ensure games is always an array
      const gamesArray = Array.isArray(gamesData.games) ? gamesData.games : [];
      setGames(gamesArray);

      setHasMore(gamesData.pagination?.hasMore || false);
      setTotalGames(gamesData.pagination?.total || 0);

      // Load analysis status for each game 🆕
      await loadAnalysisStatus(gamesArray);
    } catch (err) {
      console.error("Error loading user and games:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [userId, currentPage, gamesPerPage, loadAnalysisStatus]);

  useEffect(() => {
    if (!userId) return;
    loadUserAndGames();
  }, [userId, currentPage, loadUserAndGames]);

  const handleDeleteGame = async (gameId: string, gameInfo: string) => {
    if (!confirm(`Are you sure you want to delete the game: ${gameInfo}?`)) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      await deleteGame(gameId);
      setSuccess("Game deleted successfully");

      // Reload games
      await loadUserAndGames();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete game");
    }
  };

  // 🆕 Handle analyze button click
  const handleAnalyzeGame = (gameId: string) => {
    navigate(`/analysis/${gameId}`);
  };

  const getResultDisplay = (
    result: string,
    whitePlayer: string,
    blackPlayer: string,
    userUsername: string
  ) => {
    const isPlayingWhite =
      whitePlayer.toLowerCase() === userUsername.toLowerCase();

    if (result === "1-0") {
      return isPlayingWhite ? "Win" : "Loss";
    } else if (result === "0-1") {
      return isPlayingWhite ? "Loss" : "Win";
    } else {
      return "Draw";
    }
  };

  const getResultClass = (
    result: string,
    whitePlayer: string,
    blackPlayer: string,
    userUsername: string
  ) => {
    const displayResult = getResultDisplay(
      result,
      whitePlayer,
      blackPlayer,
      userUsername
    );
    return displayResult.toLowerCase();
  };

  const formatTimeControl = (timeControl: string) => {
    if (timeControl.includes("+")) {
      const [base, increment] = timeControl.split("+");
      const baseMin = Math.floor(parseInt(base) / 60);
      return `${baseMin}+${increment}`;
    } else {
      const totalSeconds = parseInt(timeControl);
      if (totalSeconds >= 60) {
        const minutes = Math.floor(totalSeconds / 60);
        return `${minutes} min`;
      } else {
        return `${totalSeconds}s`;
      }
    }
  };

  if (loading && currentPage === 0) {
    return (
      <div className="games-list">
        <div className="loading">Loading games...</div>
      </div>
    );
  }

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

  if (!user) {
    return (
      <div className="games-list">
        <div className="error">User not found</div>
      </div>
    );
  }

  return (
    <div className="games-list">
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

      {/* Games Table */}
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
                  <th>Analysis</th> {/* 🆕 Updated header */}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {games.map((game) => {
                  const opponent =
                    game.whitePlayer.toLowerCase() ===
                    user.chessComUsername.toLowerCase()
                      ? game.blackPlayer
                      : game.whitePlayer;

                  const userRating =
                    game.whitePlayer.toLowerCase() ===
                    user.chessComUsername.toLowerCase()
                      ? game.whiteRating
                      : game.blackRating;

                  const opponentRating =
                    game.whitePlayer.toLowerCase() ===
                    user.chessComUsername.toLowerCase()
                      ? game.blackRating
                      : game.whiteRating;

                  // 🆕 Get analysis status for this game
                  const gameAnalysisStatus = analysisStatus[game.id] || {
                    hasAnalysis: false,
                    isAnalyzing: false,
                  };

                  return (
                    <tr key={game.id}>
                      <td className="date-cell">
                        {new Date(game.playedAt).toLocaleDateString()}
                        <br />
                        <small>
                          {new Date(game.playedAt).toLocaleTimeString()}
                        </small>
                      </td>

                      <td className="opponent-cell">
                        <strong>{opponent}</strong>
                        <br />
                        <small>
                          {game.whitePlayer.toLowerCase() ===
                          user.chessComUsername.toLowerCase()
                            ? "(as White)"
                            : "(as Black)"}
                        </small>
                      </td>

                      <td
                        className={`result-cell ${getResultClass(
                          game.result,
                          game.whitePlayer,
                          game.blackPlayer,
                          user.chessComUsername
                        )}`}
                      >
                        <span className="result-badge">
                          {getResultDisplay(
                            game.result,
                            game.whitePlayer,
                            game.blackPlayer,
                            user.chessComUsername
                          )}
                        </span>
                        <br />
                        <small className="raw-result">{game.result}</small>
                      </td>

                      <td className="time-control-cell">
                        {formatTimeControl(game.timeControl)}
                      </td>

                      <td className="ratings-cell">
                        <div className="rating-pair">
                          <span className="user-rating">
                            You: {userRating || "Unrated"}
                          </span>
                          <span className="opponent-rating">
                            Opp: {opponentRating || "Unrated"}
                          </span>
                        </div>
                      </td>

                      {/* 🆕 Analysis Status Column */}
                      <td className="analysis-cell">
                        {gameAnalysisStatus.isAnalyzing ? (
                          <span className="analysis-status analyzing">
                            🔄 Analyzing...
                          </span>
                        ) : gameAnalysisStatus.hasAnalysis ? (
                          <span className="analysis-status complete">
                            ✅ Complete
                          </span>
                        ) : (
                          <span className="analysis-status none">
                            ⚪ Not analyzed
                          </span>
                        )}
                      </td>

                      <td className="actions-cell">
                        <div className="action-buttons">
                          <button
                            className="action-button view"
                            onClick={() => {
                              // TODO: Implement game view in Step 4
                              alert("Game viewer coming in Step 4!");
                            }}
                          >
                            View
                          </button>

                          {/* 🆕 Updated analyze button */}
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
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0 || loading}
              className="pagination-button"
            >
              Previous
            </button>

            <span className="pagination-info">
              Page {currentPage + 1} of {Math.ceil(totalGames / gamesPerPage)}
            </span>

            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={!hasMore || loading}
              className="pagination-button"
            >
              Next
            </button>
          </div>

          {loading && (
            <div className="loading-overlay">Loading more games...</div>
          )}
        </>
      )}

      <style>{`
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

        /* 🆕 Analysis status styling */
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

        /* 🆕 Special styling for analyzed games */
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
