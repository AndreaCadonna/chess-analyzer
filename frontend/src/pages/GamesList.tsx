
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getUserGames, getUser, deleteGame } from '../services/api';
import type { User, Game } from '../types/api';

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

  // Filter state
//   const [filters, setFilters] = useState({
//     result: '',
//     timeControl: '',
//     opponent: '',
//   });

  const loadUserAndGames = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load user data and games in parallel
      const [userData, gamesData] = await Promise.all([
        getUser(userId!),
        getUserGames(userId!, gamesPerPage, currentPage * gamesPerPage),
      ]);

      setUser(userData);
      setGames(gamesData.games);
      setHasMore(gamesData.pagination.hasMore);
      setTotalGames(gamesData.pagination.total);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [userId, currentPage, gamesPerPage]);

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
      setSuccess('Game deleted successfully');
      
      // Reload games
      await loadUserAndGames();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete game');
    }
  };

  const getResultDisplay = (result: string, whitePlayer: string, blackPlayer: string, userUsername: string) => {
    const isPlayingWhite = whitePlayer.toLowerCase() === userUsername.toLowerCase();
    
    if (result === '1-0') {
      return isPlayingWhite ? 'Win' : 'Loss';
    } else if (result === '0-1') {
      return isPlayingWhite ? 'Loss' : 'Win';
    } else {
      return 'Draw';
    }
  };

  const getResultClass = (result: string, whitePlayer: string, blackPlayer: string, userUsername: string) => {
    const displayResult = getResultDisplay(result, whitePlayer, blackPlayer, userUsername);
    return displayResult.toLowerCase();
  };

  const formatTimeControl = (timeControl: string) => {
    // Convert seconds to readable format
    // e.g., "600" -> "10 min", "180+2" -> "3+2"
    if (timeControl.includes('+')) {
      const [base, increment] = timeControl.split('+');
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
      {games.length === 0 ? (
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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {games.map((game) => {
                  const opponent = game.whitePlayer.toLowerCase() === user.chessComUsername.toLowerCase() 
                    ? game.blackPlayer 
                    : game.whitePlayer;
                  
                  const userRating = game.whitePlayer.toLowerCase() === user.chessComUsername.toLowerCase()
                    ? game.whiteRating
                    : game.blackRating;
                  
                  const opponentRating = game.whitePlayer.toLowerCase() === user.chessComUsername.toLowerCase()
                    ? game.blackRating
                    : game.whiteRating;

                  return (
                    <tr key={game.id}>
                      <td className="date-cell">
                        {new Date(game.playedAt).toLocaleDateString()}
                        <br />
                        <small>{new Date(game.playedAt).toLocaleTimeString()}</small>
                      </td>
                      
                      <td className="opponent-cell">
                        <strong>{opponent}</strong>
                        <br />
                        <small>
                          {game.whitePlayer.toLowerCase() === user.chessComUsername.toLowerCase() 
                            ? '(as White)' 
                            : '(as Black)'}
                        </small>
                      </td>
                      
                      <td className={`result-cell ${getResultClass(game.result, game.whitePlayer, game.blackPlayer, user.chessComUsername)}`}>
                        <span className="result-badge">
                          {getResultDisplay(game.result, game.whitePlayer, game.blackPlayer, user.chessComUsername)}
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
                            You: {userRating || 'Unrated'}
                          </span>
                          <span className="opponent-rating">
                            Opp: {opponentRating || 'Unrated'}
                          </span>
                        </div>
                      </td>
                      
                      <td className="actions-cell">
                        <div className="action-buttons">
                          <button
                            className="action-button view"
                            onClick={() => {
                              // TODO: Implement game view in Step 4
                              alert('Game viewer coming in Step 4!');
                            }}
                          >
                            View
                          </button>
                          
                          <button
                            className="action-button analyze"
                            onClick={() => {
                              // TODO: Implement analysis in Step 3
                              alert('Game analysis coming in Step 3!');
                            }}
                          >
                            Analyze
                          </button>
                          
                          <button
                            className="action-button delete"
                            onClick={() => handleDeleteGame(
                              game.id, 
                              `${game.whitePlayer} vs ${game.blackPlayer}`
                            )}
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
            <div className="loading-overlay">
              Loading more games...
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default GamesList;