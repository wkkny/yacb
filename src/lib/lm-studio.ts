const DEFAULT_BASE_URL = "http://127.0.0.1:1234/v1";

export function getLmStudioBaseUrl() {
  return (
    process.env.LM_STUDIO_BASE_URL?.replace(/\/$/, "") ?? DEFAULT_BASE_URL
  );
}

export function getLmStudioModel() {
  return process.env.LM_STUDIO_MODEL?.trim() || undefined;
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};
