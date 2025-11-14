// frontend/src/utils/gameFormatters.ts

/**
 * Format game result to human-readable string
 */
export const formatResult = (result: string): string => {
  if (result === '1-0') return 'White wins';
  if (result === '0-1') return 'Black wins';
  if (result === '1/2-1/2') return 'Draw';
  return result;
};

/**
 * Get color class for result badge
 */
export const getResultColor = (result: string, playerColor?: 'white' | 'black'): string => {
  if (!playerColor) {
    // General color coding
    if (result === '1-0') return 'white-win';
    if (result === '0-1') return 'black-win';
    if (result === '1/2-1/2') return 'draw';
    return 'unknown';
  }

  // Player-specific color coding
  const isWin =
    (playerColor === 'white' && result === '1-0') ||
    (playerColor === 'black' && result === '0-1');

  const isLoss =
    (playerColor === 'white' && result === '0-1') ||
    (playerColor === 'black' && result === '1-0');

  if (isWin) return 'win';
  if (isLoss) return 'loss';
  if (result === '1/2-1/2') return 'draw';
  return 'unknown';
};

/**
 * Format time control to readable format
 * Examples: "180+0" -> "3 min", "600+5" -> "10+5 min"
 */
export const formatTimeControl = (timeControl: string): string => {
  if (!timeControl) return 'Unknown';

  // Handle formats like "180", "180+0", "600+5"
  const parts = timeControl.split('+');
  const baseTime = parseInt(parts[0]);
  const increment = parts[1] ? parseInt(parts[1]) : 0;

  if (isNaN(baseTime)) return timeControl;

  const minutes = Math.floor(baseTime / 60);

  if (increment === 0) {
    return `${minutes} min`;
  }

  return `${minutes}+${increment}`;
};

/**
 * Get time control category
 */
export const getTimeControlCategory = (timeControl: string): string => {
  const parts = timeControl.split('+');
  const baseTime = parseInt(parts[0]);
  const increment = parts[1] ? parseInt(parts[1]) : 0;

  if (isNaN(baseTime)) return 'unknown';

  const totalTime = baseTime + (40 * increment); // Approximate 40 moves

  if (totalTime < 180) return 'bullet';
  if (totalTime < 600) return 'blitz';
  if (totalTime < 1800) return 'rapid';
  return 'classical';
};

/**
 * Format rating with optional difference
 */
export const formatRating = (rating?: number, diff?: number): string => {
  if (!rating) return 'Unrated';

  if (diff && diff !== 0) {
    const sign = diff > 0 ? '+' : '';
    return `${rating} (${sign}${diff})`;
  }

  return rating.toString();
};

/**
 * Get player color from game
 */
export const getPlayerColor = (game: { whitePlayer: string; blackPlayer: string }, username: string): 'white' | 'black' | null => {
  if (game.whitePlayer.toLowerCase() === username.toLowerCase()) return 'white';
  if (game.blackPlayer.toLowerCase() === username.toLowerCase()) return 'black';
  return null;
};
