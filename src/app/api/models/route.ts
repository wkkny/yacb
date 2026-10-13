import { getLmStudioBaseUrl } from "@/lib/lm-studio";

export async function GET() {
  const baseUrl = getLmStudioBaseUrl();

  try {
    const response = await fetch(`${baseUrl}/models`, {
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text();
      return Response.json(
        {
          error: "LM Studio models request failed",
          detail: detail || response.statusText,
        },
        { status: response.status },
      );
    }

    const data = (await response.json()) as {
      data?: Array<{ id: string }>;
    };

    const models = (data.data ?? [])
      .map((model) => model.id)
      .filter((id) => !/embed/i.test(id));

    return Response.json({
      models,
      baseUrl,
    });
  } catch {
    return Response.json(
      {
        error:
          "Could not reach LM Studio. Start the local server (usually http://127.0.0.1:1234) and load a model.",
        baseUrl,
      },
      { status: 503 },
    );
  }
}
