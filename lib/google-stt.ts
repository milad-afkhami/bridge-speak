import { google } from "googleapis";

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS!);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
}

export async function transcribe(audioBase64: string, languageCode: string): Promise<string> {
  const auth = getAuth();
  const token = await auth.getAccessToken();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID!;

  const recognizer = `projects/${projectId}/locations/global/recognizers/_`;

  const response = await fetch(
    `https://speech.googleapis.com/v2/${recognizer}:recognize`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        config: {
          languageCodes: [languageCode],
          model: "latest_short",
          autoDecodingConfig: {},
        },
        content: audioBase64,
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`STT error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const results = data.results ?? [];
  return results
    .map((r: { alternatives?: { transcript?: string }[] }) => r.alternatives?.[0]?.transcript ?? "")
    .join(" ")
    .trim();
}
