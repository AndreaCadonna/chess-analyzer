import { Chess } from "chess.js";

export interface ParsedGame {
  headers: Record<string, string>;
  moves: string[];
  result: string;
  isValid: boolean;
  error?: string;
}

export class PGNParser {
  static parse(pgn: string): ParsedGame {
    try {
      const chess = new Chess();
      chess.loadPgn(pgn);

      // Extract headers
      const headers: Record<string, string> = {};
      const headerRegex = /\[([^[\]]*)\s+"([^"]*)"\]/g;
      let match;

      while ((match = headerRegex.exec(pgn)) !== null) {
        headers[match[1]] = match[2];
      }

      // Get moves
      const moves = chess.history();

      return {
        headers,
        moves,
        result: headers.Result || "*",
        isValid: true,
      };
    } catch (error) {
      return {
        headers: {},
        moves: [],
        result: "*",
        isValid: false,
        error: error instanceof Error ? error.message : "PGN parsing failed",
      };
    }
  }

  static extractGameInfo(pgn: string) {
    const parsed = this.parse(pgn);

    if (!parsed.isValid) {
      throw new Error(parsed.error || "Invalid PGN");
    }

    return {
      white: parsed.headers.White || "Unknown",
      black: parsed.headers.Black || "Unknown",
      result: parsed.headers.Result || "*",
      date: parsed.headers.Date || "",
      event: parsed.headers.Event || "",
      site: parsed.headers.Site || "",
      timeControl: parsed.headers.TimeControl || "",
      whiteElo: parsed.headers.WhiteElo
        ? parseInt(parsed.headers.WhiteElo)
        : null,
      blackElo: parsed.headers.BlackElo
        ? parseInt(parsed.headers.BlackElo)
        : null,
      moves: parsed.moves,
      moveCount: parsed.moves.length,
    };
  }
}
