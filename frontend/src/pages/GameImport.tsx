import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

interface Game {
  id: string;
  chessComGameId: string;
  pgn: string;
  whitePlayer: string;
  blackPlayer: string;
  result: string;
  timeControl: string;
  whiteRating?: number;
  blackRating?: number;
  playedAt: string;
  importedAt: string;
}

const GameImport = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGame = async () => {
      if (!gameId) {
        setError("No game ID provided");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Try to fetch the game from the backend
        const response = await axios.get(
          `http://localhost:3001/api/games/${gameId}`
        );
        setGame(response.data);
      } catch (err) {
        console.error("Error fetching game:", err);
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 404) {
            setError(
              `Game with ID ${gameId} not found. Make sure the game has been imported.`
            );
          } else {
            setError(
              `Failed to load game: ${
                err.response?.data?.message || err.message
              }`
            );
          }
        } else {
          setError("An unexpected error occurred");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchGame();
  }, [gameId]);

  if (loading) {
    return (
      <div className="game-import-page">
        <div className="loading">
          <h2>Loading Game...</h2>
          <p>Fetching game data for ID: {gameId}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="game-import-page">
        <div className="error">
          <h2>Error Loading Game</h2>
          <p>{error}</p>
          <div className="error-help">
            <h3>Possible Solutions:</h3>
            <ul>
              <li>Check if the game ID is correct</li>
              <li>Make sure the backend server is running on port 3001</li>
              <li>Verify the game has been imported into the database</li>
              <li>Check the browser console for more details</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="game-import-page">
        <div className="not-found">
          <h2>Game Not Found</h2>
          <p>Game with ID {gameId} was not found in the database.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="game-import-page">
      <header className="game-header">
        <h2>Game Details</h2>
        <div className="game-meta">
          <span className="game-id">ID: {game.id}</span>
          <span className="played-date">
            Played: {new Date(game.playedAt).toLocaleDateString()}
          </span>
        </div>
      </header>

      <div className="game-info">
        <div className="players">
          <div className="player white">
            <h3>White: {game.whitePlayer}</h3>
            {game.whiteRating && (
              <span className="rating">({game.whiteRating})</span>
            )}
          </div>
          <div className="vs">vs</div>
          <div className="player black">
            <h3>Black: {game.blackPlayer}</h3>
            {game.blackRating && (
              <span className="rating">({game.blackRating})</span>
            )}
          </div>
        </div>

        <div className="game-details">
          <div className="detail">
            <strong>Result:</strong> {game.result}
          </div>
          <div className="detail">
            <strong>Time Control:</strong> {game.timeControl}
          </div>
          <div className="detail">
            <strong>Chess.com Game ID:</strong> {game.chessComGameId}
          </div>
          <div className="detail">
            <strong>Imported:</strong>{" "}
            {new Date(game.importedAt).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="pgn-section">
        <h3>PGN Data</h3>
        <div className="pgn-display">
          <pre>{game.pgn}</pre>
        </div>
      </div>

      <div className="actions">
        <button className="analyze-btn" disabled>
          Analyze Game (Coming in Step 3)
        </button>
        <button className="view-board-btn" disabled>
          View on Board (Coming in Step 4)
        </button>
      </div>

      <style>{`
        .game-import-page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }

        .game-header {
          border-bottom: 2px solid #ddd;
          margin-bottom: 20px;
          padding-bottom: 10px;
        }

        .game-meta {
          display: flex;
          gap: 20px;
          margin-top: 10px;
          color: #666;
        }

        .players {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 20px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .player {
          flex: 1;
          text-align: center;
        }

        .player h3 {
          margin: 0;
          color: #333;
        }

        .rating {
          color: #666;
          font-size: 0.9em;
        }

        .vs {
          font-weight: bold;
          font-size: 1.2em;
          color: #666;
        }

        .game-details {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 10px;
          margin-bottom: 20px;
        }

        .detail {
          padding: 10px;
          background: #f8f9fa;
          border-radius: 4px;
        }

        .pgn-section {
          margin-bottom: 20px;
        }

        .pgn-display {
          background: #f5f5f5;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 15px;
          max-height: 300px;
          overflow-y: auto;
        }

        .pgn-display pre {
          margin: 0;
          white-space: pre-wrap;
          font-family: "Courier New", monospace;
          font-size: 0.9em;
          line-height: 1.4;
        }

        .actions {
          display: flex;
          gap: 10px;
        }

        .analyze-btn,
        .view-board-btn {
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 1em;
        }

        .analyze-btn {
          background: #007bff;
          color: white;
        }

        .view-board-btn {
          background: #28a745;
          color: white;
        }

        .analyze-btn:disabled,
        .view-board-btn:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .loading,
        .error,
        .not-found {
          text-align: center;
          padding: 40px;
        }

        .error-help {
          text-align: left;
          max-width: 500px;
          margin: 20px auto;
        }

        .error-help ul {
          padding-left: 20px;
        }
      `}</style>
    </div>
  );
};

export default GameImport;
