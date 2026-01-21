export enum GameState {
  START = 'START',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

export interface Obstacle {
  id: number;
  x: number;
  topHeight: number;
  width: number;
  passed: boolean;
}

export interface ScoreBoard {
  current: number;
  best: number;
}