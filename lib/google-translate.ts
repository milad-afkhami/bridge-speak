import { google } from "googleapis";

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS!);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
}

export async function translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
  const auth = getAuth();
  const token = await auth.getAccessToken();

  const response = await fetch(
    `https://translation.googleapis.com/language/translate/v2`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: text,
        source: sourceLang,
        target: targetLang,
        format: "text",
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Translate error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.data.translations[0].translatedText as string;
}
