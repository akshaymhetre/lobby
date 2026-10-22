import { TEMPLATE_CSV } from "@lobby/core/people/csv";
import { currentUser } from "@/server/auth";

/** The CSV template for people imports. Admins only. */
export async function GET() {
  const ctx = await currentUser();
  if (!ctx?.has("admin")) return new Response("Not allowed", { status: 403 });
  return new Response(TEMPLATE_CSV, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="lobby-people-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
