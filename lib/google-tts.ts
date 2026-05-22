import { google } from "googleapis";

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS!);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
}

const VOICES: Record<string, { name: string; languageCode: string }> = {
  "en-US": { name: "en-US-Neural2-D", languageCode: "en-US" },
  "hy-AM": { name: "hy-AM-Standard-A", languageCode: "hy-AM" },
};

export async function synthesize(text: string, languageCode: string): Promise<string> {
  const auth = getAuth();
  const token = await auth.getAccessToken();
  const voice = VOICES[languageCode];

  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: voice.languageCode,
          name: voice.name,
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: 1.0,
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`TTS error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.audioContent as string; // base64 MP3
}
