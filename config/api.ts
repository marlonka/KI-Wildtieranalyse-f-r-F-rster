import { GoogleGenAI } from "@google/genai";

/**
 * Creates a GoogleGenAI instance.
 * The API key is sourced directly from the `process.env.API_KEY`
 * environment variable, which is injected by the execution environment.
 */
export function createGeminiClient(): GoogleGenAI {
  const client = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return client;
}
