import { NextResponse } from "next/server";
import { transcribe } from "@/lib/google-stt";
import { translate } from "@/lib/google-translate";
import { synthesize } from "@/lib/google-tts";
import type { TranslateRequest, TranslateResponse } from "@/lib/types";

export const maxDuration = 15;

// ── Mock mode (no credentials configured) ────────────────────────────────────

const MOCK_PAIRS: Record<TranslateRequest["direction"], { source: string; target: string }[]> = {
  "en-to-hy": [
    { source: "Hello, how are you?", target: "Բարև, ինչպե՞ս ես:" },
    { source: "Nice to meet you.", target: "Ուրախ եմ ծանոթանալ:" },
    { source: "Thank you very much.", target: "Շատ շնորհակալ եմ:" },
  ],
  "hy-to-en": [
    { source: "Ես լավ եմ, շնորհակալություն:", target: "I'm doing well, thank you." },
    { source: "Ո՞ւր ես գնում:", target: "Where are you going?" },
    { source: "Արի միասին ուտենք:", target: "Let's eat together." },
  ],
};

let mockIndex = 0;

async function mockPipeline(direction: TranslateRequest["direction"]): Promise<TranslateResponse> {
  await new Promise((r) => setTimeout(r, 800)); // simulate latency
  const pairs = MOCK_PAIRS[direction];
  const pair = pairs[mockIndex % pairs.length];
  mockIndex++;
  return { sourceText: pair.source, targetText: pair.target, audio: "", audioFormat: "mp3" };
}

// ── Real pipeline ─────────────────────────────────────────────────────────────

async function runPipeline(audio: string, direction: TranslateRequest["direction"]): Promise<TranslateResponse> {
  const isEnToHy = direction === "en-to-hy";
  const sourceLangCode = isEnToHy ? "en-US" : "hy-AM";
  const targetLangCode = isEnToHy ? "hy-AM" : "en-US";
  const sourceLang = isEnToHy ? "en" : "hy";
  const targetLang = isEnToHy ? "hy" : "en";

  const sourceText = await transcribe(audio, sourceLangCode);
  if (!sourceText) throw new Error("No speech detected");

  const targetText = await translate(sourceText, sourceLang, targetLang);
  const audioContent = await synthesize(targetText, targetLangCode);

  return { sourceText, targetText, audio: audioContent, audioFormat: "mp3" };
}

// ── Handler ───────────────────────────────────────────────────────────────────

const isMockMode =
  !process.env.GOOGLE_CLOUD_CREDENTIALS ||
  process.env.GOOGLE_CLOUD_CREDENTIALS.includes("YOUR_PROJECT");

export async function POST(req: Request) {
  try {
    const body: TranslateRequest = await req.json();
    const { audio, direction } = body;

    if (!direction) {
      return NextResponse.json({ error: "Missing direction" }, { status: 400 });
    }

    if (isMockMode) {
      const result = await mockPipeline(direction);
      return NextResponse.json(result);
    }

    if (!audio) {
      return NextResponse.json({ error: "Missing audio" }, { status: 400 });
    }

    try {
      const result = await runPipeline(audio, direction);
      return NextResponse.json(result);
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
      const result = await runPipeline(audio, direction);
      return NextResponse.json(result);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
