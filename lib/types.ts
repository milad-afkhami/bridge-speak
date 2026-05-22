export type Direction = "en-to-hy" | "hy-to-en";

export interface TranslateRequest {
  audio: string; // base64
  direction: Direction;
}

export interface TranslateResponse {
  sourceText: string;
  targetText: string;
  audio: string; // base64 MP3
  audioFormat: "mp3" | "wav";
}

export type AppStatus = "idle" | "recording" | "processing" | "playing" | "error";

export interface Message {
  id: string;
  direction: Direction;
  sourceText: string;
  targetText: string;
  timestamp: number;
}
