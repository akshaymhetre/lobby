import { NextResponse } from "next/server";
import { audit } from "@lobby/core";
import { exportConfig } from "@lobby/config";
import { currentUser } from "@/server/auth";

export async function GET() {
  const ctx = await currentUser();
  if (!ctx) return new NextResponse("Sign in first.", { status: 401 });
  if (!ctx.has("admin")) return new NextResponse("Only administrators can export the configuration.", { status: 403 });
  const yaml = await exportConfig();
  await audit(ctx.user.id, "config.exported", { type: "config", id: "yaml" });
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(yaml, {
    headers: {
      "Content-Type": "application/yaml; charset=utf-8",
      "Content-Disposition": `attachment; filename="lobby-${stamp}.yaml"`,
      "Cache-Control": "no-store",
    },
  });
}
