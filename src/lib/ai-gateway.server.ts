import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-3.6-flash";

export async function chatJson<T>(
  system: string,
  user: string
): Promise<T> {
  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({
    apiKey: key,
  });

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: user,
      config: {
        systemInstruction: system,
        temperature: 0.3,
        responseMimeType: "application/json",
      },
    });

    const text = response.text ?? "";

    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    return extractJson<T>(text);
  } catch (error) {
    console.error("Gemini AI error:", error);

    throw new Error(
      error instanceof Error
        ? error.message
        : "Gemini AI request failed."
    );
  }
}

export function extractJson<T>(text: string): T {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const objStart = cleaned.indexOf("{");
  const arrStart = cleaned.indexOf("[");

  const start =
    objStart === -1
      ? arrStart
      : arrStart === -1
        ? objStart
        : Math.min(objStart, arrStart);

  const end = Math.max(
    cleaned.lastIndexOf("}"),
    cleaned.lastIndexOf("]")
  );

  if (start === -1 || end === -1) {
    throw new Error("AI response was not valid JSON.");
  }

  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}
