/** Pulls the JSON { error, code } an edge function sent with a non-2xx status out of supabase-js's error. */
export async function readFunctionError(error: unknown, fallback = "Something went wrong"): Promise<{ message: string; code?: string }> {
  const e = error as { message?: string; code?: string; context?: unknown } | null;
  if (e?.context instanceof Response) {
    try {
      const body = await e.context.clone().json();
      return { message: String(body?.error ?? e.message ?? fallback), code: body?.code };
    } catch { /* not JSON */ }
  }
  return { message: e?.message ?? fallback, code: e?.code };
}

export const AI_NOT_CONNECTED = "ai_not_connected";
export const AI_CONNECT_PATH = "/app/settings#ai";
