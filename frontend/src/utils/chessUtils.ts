/* eslint-disable @typescript-eslint/no-explicit-any */
// frontend/src/utils/chessUtils.ts
import { Chess } from "chess.js";
import type { Move, Square } from "chess.js";

export interface MoveValidationResult {
  isValid: boolean;
  move?: Move;
  error?: string;
}

export interface PositionAnalysis {
  legalMoves: Move[];
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  turn: "w" | "b";
  castlingRights: string;
  enPassantSquare: string | null;
  halfmoveClock: number;
  fullmoveNumber: number;
}

export class ChessUtils {
  /**
   * Validate a move attempt
   */
  static validateMove(
    fen: string,
    from: Square,
    to: Square,
    promotion?: string
  ): MoveValidationResult {
    try {
      const chess = new Chess(fen);

      const move = chess.move({
        from,
        to,
        promotion: promotion as any, // Handle promotion
      });

      if (move) {
        return {
          isValid: true,
          move,
        };
      } else {
        return {
          isValid: false,
          error: "Invalid move",
        };
      }
    } catch (error) {
      return {
        isValid: false,
        error:
          error instanceof Error ? error.message : "Move validation failed",
      };
    }
  }

  /**
   * Get comprehensive position analysis
   */
  static analyzePosition(fen: string): PositionAnalysis {
    const chess = new Chess(fen);

    return {
      legalMoves: chess.moves({ verbose: true }),
      isCheck: chess.inCheck(),
      isCheckmate: chess.isCheckmate(),
      isStalemate: chess.isStalemate(),
      isDraw: chess.isDraw(),
      turn: chess.turn(),
      castlingRights: fen.split(" ")[2] || "-",
      enPassantSquare: fen.split(" ")[3] !== "-" ? fen.split(" ")[3] : null,
      halfmoveClock: parseInt(fen.split(" ")[4]) || 0,
      fullmoveNumber: parseInt(fen.split(" ")[5]) || 1,
    };
  }

  /**
   * Get all legal moves from a specific square
   */
  static getLegalMovesFromSquare(fen: string, square: Square): Move[] {
    const chess = new Chess(fen);
    const allMoves = chess.moves({ verbose: true });
    return allMoves.filter((move) => move.from === square);
  }

  /**
   * Get all legal moves to a specific square
   */
  static getLegalMovesToSquare(fen: string, square: Square): Move[] {
    const chess = new Chess(fen);
    const allMoves = chess.moves({ verbose: true });
    return allMoves.filter((move) => move.to === square);
  }

  /**
   * Check if a square is under attack
   */
  static isSquareAttacked(
    fen: string,
    square: Square,
    byColor: "w" | "b"
  ): boolean {
    try {
      const chess = new Chess(fen);

      // Temporarily switch turn to check attacks
      const currentTurn = chess.turn();
      if (currentTurn !== byColor) {
        // Create a modified FEN with switched turn
        const fenParts = fen.split(" ");
        fenParts[1] = byColor;
        const modifiedFen = fenParts.join(" ");
        const modifiedChess = new Chess(modifiedFen);
        const moves = modifiedChess.moves({ verbose: true });
        return moves.some((move) => move.to === square);
      } else {
        const moves = chess.moves({ verbose: true });
        return moves.some((move) => move.to === square);
      }
    } catch {
      return false;
    }
  }

  /**
   * Get piece on a square
   */
  static getPieceOnSquare(
    fen: string,
    square: Square
  ): { type: string; color: string } | null {
    try {
      const chess = new Chess(fen);
      const piece = chess.get(square);
      return piece || null;
    } catch {
      return null;
    }
  }

  /**
   * Convert algebraic notation to move coordinates
   */
  static parseAlgebraicMove(
    fen: string,
    algebraic: string
  ): { from: Square; to: Square; promotion?: string } | null {
    try {
      const chess = new Chess(fen);
      const moves = chess.moves({ verbose: true });
      const move = moves.find((m) => m.san === algebraic);

      if (move) {
        return {
          from: move.from,
          to: move.to,
          promotion: move.promotion,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get game result from position
   */
  static getGameResult(
    fen: string
  ): "ongoing" | "checkmate" | "stalemate" | "draw" {
    const chess = new Chess(fen);

    if (chess.isCheckmate()) return "checkmate";
    if (chess.isStalemate()) return "stalemate";
    if (chess.isDraw()) return "draw";
    return "ongoing";
  }

  /**
   * Generate FEN after a sequence of moves
   */
  static playMoveSequence(startingFen: string, moves: string[]): string | null {
    try {
      const chess = new Chess(startingFen);

      for (const moveStr of moves) {
        const move = chess.move(moveStr);
        if (!move) {
          return null; // Invalid move in sequence
        }
      }

      return chess.fen();
    } catch {
      return null;
    }
  }

  /**
   * Get move history from starting FEN to current FEN
   */
  static getMoveHistory(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    startingFen: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    currentFen: string
  ): Move[] | null {
    // This is a complex operation that would require move history tracking
    // For now, return null as it's not easily computable from just FENs
    return null;
  }

  /**
   * Check if position is theoretical endgame
   */
  static isEndgame(fen: string): boolean {
    const chess = new Chess(fen);
    const board = chess.board();

    let pieceCount = 0;
    let hasQueens = false;
    let hasRooks = false;

    for (const row of board) {
      for (const square of row) {
        if (square) {
          pieceCount++;
          if (square.type === "q") hasQueens = true;
          if (square.type === "r") hasRooks = true;
        }
      }
    }

    // Consider it endgame if:
    // - Less than 10 pieces total, OR
    // - No queens and less than 12 pieces, OR
    // - No queens or rooks and less than 8 pieces
    return (
      pieceCount < 10 ||
      (!hasQueens && pieceCount < 12) ||
      (!hasQueens && !hasRooks && pieceCount < 8)
    );
  }

  /**
   * Get material balance
   */
  static getMaterialBalance(fen: string): {
    white: number;
    black: number;
    difference: number;
  } {
    const chess = new Chess(fen);
    const board = chess.board();

    const pieceValues = {
      p: 1,
      n: 3,
      b: 3,
      r: 5,
      q: 9,
      k: 0,
    };

    let whiteMaterial = 0;
    let blackMaterial = 0;

    for (const row of board) {
      for (const square of row) {
        if (square) {
          const value =
            pieceValues[square.type as keyof typeof pieceValues] || 0;
          if (square.color === "w") {
            whiteMaterial += value;
          } else {
            blackMaterial += value;
          }
        }
      }
    }

    return {
      white: whiteMaterial,
      black: blackMaterial,
      difference: whiteMaterial - blackMaterial,
    };
  }

  /**
   * Format move for display
   */
  static formatMove(move: Move, includeCheck: boolean = true): string {
    const formatted = move.san;

    if (includeCheck && move.san.includes("+")) {
      // Already includes check notation
    }

    return formatted;
  }

  /**
   * Get position evaluation category
   */
  static getEvaluationCategory(evaluation: number): {
    category: "winning" | "advantage" | "slight" | "equal" | "losing";
    description: string;
    color: string;
  } {
    const absEval = Math.abs(evaluation);

    if (absEval >= 5) {
      return {
        category: evaluation > 0 ? "winning" : "losing",
        description: evaluation > 0 ? "White winning" : "Black winning",
        color: evaluation > 0 ? "#28a745" : "#dc3545",
      };
    } else if (absEval >= 2) {
      return {
        category: evaluation > 0 ? "advantage" : "losing",
        description: evaluation > 0 ? "White advantage" : "Black advantage",
        color: evaluation > 0 ? "#17a2b8" : "#fd7e14",
      };
    } else if (absEval >= 0.5) {
      return {
        category: "slight",
        description:
          evaluation > 0 ? "Slight white advantage" : "Slight black advantage",
        color: evaluation > 0 ? "#20c997" : "#ffc107",
      };
    } else {
      return {
        category: "equal",
        description: "Equal position",
        color: "#6c757d",
      };
    }
  }
}

export default ChessUtils;
