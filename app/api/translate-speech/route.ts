import { NextResponse } from "next/server";
import { transcribe } from "@/lib/google-stt";
import { translate } from "@/lib/google-translate";
import { synthesize } from "@/lib/google-tts";
import type { TranslateRequest, TranslateResponse } from "@/lib/types";

export const maxDuration = 15;

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

export async function POST(req: Request) {
  try {
    const body: TranslateRequest = await req.json();
    const { audio, direction } = body;

    if (!audio || !direction) {
      return NextResponse.json({ error: "Missing audio or direction" }, { status: 400 });
    }

    try {
      const result = await runPipeline(audio, direction);
      return NextResponse.json(result);
    } catch {
      // One automatic retry after 1 second
      await new Promise((r) => setTimeout(r, 1000));
      const result = await runPipeline(audio, direction);
      return NextResponse.json(result);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
