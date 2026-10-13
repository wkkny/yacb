import {
  getLmStudioBaseUrl,
  getLmStudioModel,
  type ChatMessage,
} from "@/lib/lm-studio";

type ChatRequestBody = {
  messages?: ChatMessage[];
  model?: string;
};

export async function POST(request: Request) {
  let body: ChatRequestBody;

  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json(
      { error: "messages must be a non-empty array" },
      { status: 400 },
    );
  }

  const baseUrl = getLmStudioBaseUrl();
  const model = body.model?.trim() || getLmStudioModel();

  if (!model) {
    return Response.json(
      {
        error:
          "No model selected. Load a model in LM Studio or set LM_STUDIO_MODEL.",
      },
      { status: 400 },
    );
  }

  let upstream: Response;

  try {
    upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: 0.7,
      }),
    });
  } catch {
    return Response.json(
      {
        error:
          "Could not reach LM Studio. Start the local server and load a model.",
        baseUrl,
      },
      { status: 503 },
    );
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text();
    return Response.json(
      {
        error: "LM Studio chat request failed",
        detail: detail || upstream.statusText,
      },
      { status: upstream.status || 502 },
    );
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
