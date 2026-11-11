// Respostas e leitura de JSON, com limite de tamanho (entrada não confiável).
export const json = (body: unknown, status = 200): Response =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

export const errorResponse = (error: string, status: number): Response => json({ error }, status);

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const text = await request.text();
  if (text.length > 4000) return null;
  try {
    const data: unknown = JSON.parse(text);
    return typeof data === "object" && data !== null && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer (.{8,100})$/.exec(header);
  return match ? (match[1] as string) : null;
}
