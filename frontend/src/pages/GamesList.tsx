import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { getUserGames, getUser, deleteGame } from "../services/api";
import type { User, Game } from "../types/api";

const GamesList: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();

  const [user, setUser] = useState<User | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalGames, setTotalGames] = useState(0);
  const gamesPerPage = 20;

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
      console.log("Current page:", currentPage);
      console.log("Games per page:", gamesPerPage);
      console.log("Offset:", currentPage * gamesPerPage);

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

      console.log("Final state:");
      console.log("- Games count:", gamesArray.length);
      console.log("- Total games:", gamesData.pagination?.total || 0);
      console.log("- Has more:", gamesData.pagination?.hasMore || false);
      console.log("- Games array:", gamesArray);
    } catch (err) {
      console.error("Error loading user and games:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [userId, currentPage, gamesPerPage]);

  useEffect(() => {
    console.log("useEffect triggered, userId:", userId);
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
    // Convert seconds to readable format
    // e.g., "600" -> "10 min", "180+2" -> "3+2"
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

  // Debug render states
  console.log("Render state:", {
    loading,
    user: !!user,
    gamesCount: games.length,
    error,
    userId,
    gamesIsArray: Array.isArray(games),
  });

  if (loading && currentPage === 0) {
    return (
      <div className="games-list">
        <div className="loading">Loading games...</div>
        <div
          style={{
            padding: "20px",
            background: "#f0f0f0",
            margin: "20px",
            borderRadius: "8px",
          }}
        >
          <h3>Debug Info</h3>
          <p>User ID: {userId}</p>
          <p>Loading: {loading ? "Yes" : "No"}</p>
          <p>Current Page: {currentPage}</p>
        </div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="games-list">
        <div className="error">
          <h2>Error</h2>
          <p>{error}</p>
          <div
            style={{
              padding: "20px",
              background: "#f0f0f0",
              margin: "20px",
              borderRadius: "8px",
            }}
          >
            <h3>Debug Info</h3>
            <p>User ID: {userId}</p>
            <p>Error: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="games-list">
        <div className="error">User not found</div>
        <div
          style={{
            padding: "20px",
            background: "#f0f0f0",
            margin: "20px",
            borderRadius: "8px",
          }}
        >
          <h3>Debug Info</h3>
          <p>User ID: {userId}</p>
          <p>User object: {user ? "Found" : "Not found"}</p>
          <p>Loading: {loading ? "Yes" : "No"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="games-list">
      {/* Debug Panel */}
      <div
        style={{
          padding: "20px",
          background: "#f0f0f0",
          margin: "20px",
          borderRadius: "8px",
        }}
      >
        <h3>Debug Info</h3>
        <p>User ID: {userId}</p>
        <p>
          User: {user.chessComUsername} (ID: {user.id})
        </p>
        <p>Games loaded: {games.length}</p>
        <p>Games is array: {Array.isArray(games) ? "Yes" : "No"}</p>
        <p>Total games: {totalGames}</p>
        <p>Has more: {hasMore ? "Yes" : "No"}</p>
        <p>Current page: {currentPage}</p>
        <p>Loading: {loading ? "Yes" : "No"}</p>
        <p>Error: {error || "None"}</p>
      </div>

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
          <p>
            <strong>Debug:</strong> Total games in database: {totalGames}
          </p>
          <p>
            <strong>Debug:</strong> Games is array:{" "}
            {Array.isArray(games) ? "Yes" : "No"}
          </p>
          <p>
            <strong>Debug:</strong> Games value: {JSON.stringify(games)}
          </p>
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

                          <button
                            className="action-button analyze"
                            onClick={() => {
                              // TODO: Implement analysis in Step 3
                              alert("Game analysis coming in Step 3!");
                            }}
                          >
                            Analyze
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
          max-width: 1200px;
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
          overflow-x: auto;
          margin-bottom: 20px;
        }

        .games-table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .games-table th,
        .games-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #ddd;
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

        .ratings-cell {
          font-size: 0.9em;
        }

        .rating-pair {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .user-rating {
          color: #333;
        }

        .opponent-rating {
          color: #666;
        }

        .action-buttons {
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
        }

        .action-button {
          padding: 4px 8px;
          border: none;
          border-radius: 3px;
          cursor: pointer;
          font-size: 0.8em;
        }

        .action-button.view {
          background: #17a2b8;
          color: white;
        }

        .action-button.analyze {
          background: #28a745;
          color: white;
        }

        .action-button.delete {
          background: #dc3545;
          color: white;
        }

        .action-button:hover {
          opacity: 0.8;
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
      `}</style>
    </div>
  );
};

export default GamesList;
