"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { AppStatus, Direction, Message, TranslateResponse } from "@/lib/types";

// ── State ─────────────────────────────────────────────────────────────────────

interface State {
  status: AppStatus;
  activeRecorder: "A" | "B" | null;
  messages: Message[];
  lastError: string | null;
  pendingAudio: string | null;
  pendingDirection: Direction | null;
}

type Action =
  | { type: "START_RECORDING"; recorder: "A" | "B" }
  | { type: "STOP_RECORDING" }
  | { type: "PROCESSING" }
  | { type: "PLAYING"; message: Message }
  | { type: "DONE" }
  | { type: "ERROR"; error: string; audio?: string; direction?: Direction }
  | { type: "RETRY" }
  | { type: "CANCEL_PLAYBACK" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "START_RECORDING":
      return { ...state, status: "recording", activeRecorder: action.recorder, lastError: null };
    case "STOP_RECORDING":
      return { ...state, status: "processing" };
    case "PROCESSING":
      return { ...state, status: "processing" };
    case "PLAYING":
      return {
        ...state,
        status: "playing",
        messages: [...state.messages, action.message],
        pendingAudio: null,
        pendingDirection: null,
        lastError: null,
      };
    case "DONE":
      return { ...state, status: "idle", activeRecorder: null };
    case "ERROR":
      return {
        ...state,
        status: "error",
        lastError: action.error,
        activeRecorder: null,
        pendingAudio: action.audio ?? state.pendingAudio,
        pendingDirection: action.direction ?? state.pendingDirection,
      };
    case "RETRY":
      return { ...state, status: "processing", lastError: null };
    case "CANCEL_PLAYBACK":
      return { ...state, status: "idle", activeRecorder: null };
    default:
      return state;
  }
}

const initialState: State = {
  status: "idle",
  activeRecorder: null,
  messages: [],
  lastError: null,
  pendingAudio: null,
  pendingDirection: null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function callApi(audio: string, direction: Direction): Promise<TranslateResponse> {
  const res = await fetch("/api/translate-speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audio, direction }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V20H9v2h6v-2h-2v-2.07A7 7 0 0 0 19 11h-2z" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Chat Panel ────────────────────────────────────────────────────────────────

interface ChatPanelProps {
  messages: Message[];
  perspective: "A" | "B";
}

function ChatPanel({ messages, perspective }: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm italic min-h-0">
        Conversation will appear here
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
      {messages.map((msg) => {
        const isOwn =
          (perspective === "A" && msg.direction === "en-to-hy") ||
          (perspective === "B" && msg.direction === "hy-to-en");
        const original = isOwn ? msg.sourceText : msg.targetText;
        const translation = isOwn ? msg.targetText : msg.sourceText;

        return (
          <div key={msg.id} className={`text-sm ${isOwn ? "text-right" : "text-left"}`}>
            <div className="text-gray-500 text-xs mb-0.5 font-medium">{isOwn ? "You" : "Them"}</div>
            <div className="text-white leading-snug">{original}</div>
            <div className="text-indigo-300 text-xs mt-1 italic">→ {translation}</div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

// ── Mic Button ────────────────────────────────────────────────────────────────

interface MicButtonProps {
  person: "A" | "B";
  status: AppStatus;
  activeRecorder: "A" | "B" | null;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancelPlayback: () => void;
  onRetry: () => void;
  lastError: string | null;
}

function MicButton({
  person,
  status,
  activeRecorder,
  onStartRecording,
  onStopRecording,
  onCancelPlayback,
  onRetry,
  lastError,
}: MicButtonProps) {
  const isRecordingMe = status === "recording" && activeRecorder === person;
  const isOtherRecording = status === "recording" && activeRecorder !== person;
  const disabled = isOtherRecording || status === "processing" || status === "playing";

  if (status === "error" && lastError) {
    return (
      <div className="flex flex-col items-center gap-2 py-1">
        <div className="text-red-400 text-xs text-center px-4 max-w-xs">{lastError}</div>
        <button
          onClick={onRetry}
          className="px-5 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-semibold transition-colors"
        >
          Tap to try again
        </button>
      </div>
    );
  }

  if (status === "playing") {
    return (
      <button
        onClick={onCancelPlayback}
        className="flex items-center gap-3 px-6 py-3.5 bg-gray-700 hover:bg-gray-600 rounded-2xl transition-colors"
      >
        <StopIcon className="w-6 h-6 text-white" />
        <span className="text-sm text-gray-200 font-medium">Stop playback</span>
      </button>
    );
  }

  if (status === "processing") {
    return (
      <div className="flex items-center gap-3 px-6 py-3.5">
        <Spinner className="w-6 h-6 text-indigo-400" />
        <span className="text-sm text-gray-400">Translating…</span>
      </div>
    );
  }

  if (isRecordingMe) {
    return (
      <button
        onClick={onStopRecording}
        className="flex items-center gap-3 px-6 py-3.5 bg-red-600 hover:bg-red-500 rounded-2xl transition-colors"
      >
        {/* Pulsing red dot */}
        <span className="relative flex h-4 w-4 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75" />
          <span className="relative inline-flex rounded-full h-4 w-4 bg-red-200" />
        </span>
        <span className="text-sm text-white font-semibold">Tap to stop</span>
      </button>
    );
  }

  return (
    <button
      onClick={onStartRecording}
      disabled={disabled}
      className={`flex items-center gap-3 px-6 py-3.5 rounded-2xl transition-colors ${
        disabled
          ? "bg-gray-800 text-gray-600 cursor-not-allowed"
          : "bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white shadow-lg shadow-indigo-900/40"
      }`}
    >
      <MicIcon className="w-6 h-6 shrink-0" />
      <span className="text-sm font-semibold">{disabled ? "Please wait…" : "Tap to speak"}</span>
    </button>
  );
}

// ── Desktop Guard ─────────────────────────────────────────────────────────────

function DesktopGuard() {
  return (
    <div className="hidden sm:flex h-full flex-col items-center justify-center text-center px-8 gap-4">
      <div className="text-5xl">📱</div>
      <p className="text-gray-300 text-lg font-medium">Open on your phone</p>
      <p className="text-gray-500 text-sm max-w-xs">
        BridgeSpeak is designed for two people sharing a single mobile device.
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingPersonRef = useRef<"A" | "B">("A");

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }, []);

  const playAudio = useCallback(
    (base64Mp3: string, onDone: () => void) => {
      if (!base64Mp3) { onDone(); return; }
      stopAudio();
      const audio = new Audio(`data:audio/mp3;base64,${base64Mp3}`);
      audioRef.current = audio;
      audio.onended = onDone;
      audio.onerror = onDone;
      audio.play().catch(onDone);
    },
    [stopAudio]
  );

  const runTranslation = useCallback(
    async (audioBase64: string, direction: Direction) => {
      dispatch({ type: "PROCESSING" });
      try {
        const result = await callApi(audioBase64, direction);
        const message: Message = {
          id: crypto.randomUUID(),
          direction,
          sourceText: result.sourceText,
          targetText: result.targetText,
          timestamp: Date.now(),
        };
        dispatch({ type: "PLAYING", message });
        playAudio(result.audio, () => dispatch({ type: "DONE" }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Translation failed";
        dispatch({ type: "ERROR", error: msg, audio: audioBase64, direction });
      }
    },
    [playAudio]
  );

  const startRecording = useCallback(async (person: "A" | "B") => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = recorder;
      pendingPersonRef.current = person;
      recorder.start();
      dispatch({ type: "START_RECORDING", recorder: person });
    } catch {
      dispatch({ type: "ERROR", error: "Microphone access denied" });
    }
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    dispatch({ type: "STOP_RECORDING" });

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
      recorder.stream.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current = null;
      try {
        const base64 = await blobToBase64(blob);
        const direction: Direction = pendingPersonRef.current === "A" ? "en-to-hy" : "hy-to-en";
        await runTranslation(base64, direction);
      } catch {
        dispatch({ type: "ERROR", error: "Failed to process audio" });
      }
    };

    recorder.stop();
  }, [runTranslation]);

  const handleCancelPlayback = useCallback(() => {
    stopAudio();
    dispatch({ type: "CANCEL_PLAYBACK" });
  }, [stopAudio]);

  const handleRetry = useCallback(() => {
    if (state.pendingAudio && state.pendingDirection) {
      dispatch({ type: "RETRY" });
      runTranslation(state.pendingAudio, state.pendingDirection);
    }
  }, [state.pendingAudio, state.pendingDirection, runTranslation]);

  const sharedMicProps = {
    status: state.status,
    activeRecorder: state.activeRecorder,
    onStopRecording: stopRecording,
    onCancelPlayback: handleCancelPlayback,
    onRetry: handleRetry,
    lastError: state.lastError,
  };

  return (
    <>
      {/* Desktop: show redirect message */}
      <DesktopGuard />

      {/* Mobile: full app */}
      <main className="h-full flex flex-col select-none sm:hidden">

        {/* ── Person A — English ─────────────────────────────────────────────
            Layout (top → bottom = outer edge → center):
              1. Language label   (outer edge)
              2. Mic button
              3. Chat transcript  (grows toward center)
        ──────────────────────────────────────────────────────────────────── */}
        <section className="flex-1 flex flex-col bg-gray-900 border-b border-gray-700 min-h-0">
          <div className="px-4 pt-3 pb-1 shrink-0">
            <span className="text-xs font-bold text-indigo-400 tracking-widest uppercase">English</span>
          </div>

          <div className="flex justify-center py-3 shrink-0">
            <MicButton person="A" onStartRecording={() => startRecording("A")} {...sharedMicProps} />
          </div>

          <ChatPanel messages={state.messages} perspective="A" />
        </section>

        {/* ── Person B — Armenian (rotated 180°) ────────────────────────────
            Physical layout before rotation (top → bottom):
              1. Chat transcript  (physically near center)
              2. Mic button
              3. Language label   (physically at outer edge / bottom of screen)

            After rotation Person B reads (their top → their bottom):
              1. Language label   (outer edge — same as Person A experience)
              2. Mic button
              3. Chat transcript  (grows toward center)
        ──────────────────────────────────────────────────────────────────── */}
        <section
          className="flex-1 flex flex-col bg-gray-900 min-h-0"
          style={{ transform: "rotate(180deg)" }}
        >
          <ChatPanel messages={state.messages} perspective="B" />

          <div className="flex justify-center py-3 shrink-0">
            <MicButton person="B" onStartRecording={() => startRecording("B")} {...sharedMicProps} />
          </div>

          <div className="px-4 pb-3 pt-1 shrink-0">
            <span className="text-xs font-bold text-amber-400 tracking-widest uppercase">
              Armenian · Հայerεն
            </span>
          </div>
        </section>
      </main>
    </>
  );
}
