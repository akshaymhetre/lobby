import { pg } from "@lobby/db";

export const dynamic = "force-dynamic";

/** Liveness and database readiness for container health checks. No sign-in required. */
export async function GET() {
  try {
    await pg`select 1`;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "database unreachable" }, { status: 503 });
  }
}
