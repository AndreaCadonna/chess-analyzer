export interface ChessComPlayer {
  player_id: number;
  username: string;
  title?: string;
  status: string;
  name?: string;
  avatar?: string;
  location?: string;
  country: string;
  joined: number;
  last_online: number;
  followers: number;
  is_streamer: boolean;
  verified: boolean;
}

export interface ChessComGame {
  url: string;
  pgn: string;
  time_control: string;
  rated: boolean;
  time_class: "daily" | "rapid" | "blitz" | "bullet";
  rules: string;
  white: {
    rating: number;
    result:
      | "win"
      | "checkmated"
      | "agreed"
      | "timeout"
      | "resigned"
      | "stalemate"
      | "lose"
      | "insufficient"
      | "50move"
      | "repetition"
      | "timevsinsufficient"
      | "bughousepartnerlose";
    username: string;
    uuid: string;
  };
  black: {
    rating: number;
    result:
      | "win"
      | "checkmated"
      | "agreed"
      | "timeout"
      | "resigned"
      | "stalemate"
      | "lose"
      | "insufficient"
      | "50move"
      | "repetition"
      | "timevsinsufficient"
      | "bughousepartnerlose";
    username: string;
    uuid: string;
  };
  end_time: number;
  start_time?: number;
  tournament?: string;
  match?: string;
}

export interface ChessComMonthlyGames {
  games: ChessComGame[];
}

export interface ChessComArchives {
  archives: string[];
}
