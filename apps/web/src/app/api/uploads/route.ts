import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@lobby/core";
import { MAX_UPLOAD_BYTES, saveUpload, UploadError } from "@lobby/core/admin";
import { currentUser } from "@/server/auth";

/** Admin-only image upload (company logo). The type is decided from the bytes, never from the name. */
export async function POST(req: NextRequest) {
  const ctx = await currentUser();
  if (!ctx) return NextResponse.json({ error: "Sign in again to upload." }, { status: 401 });
  if (!ctx.has("admin")) return NextResponse.json({ error: "Only administrators can upload a logo." }, { status: 403 });

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "That image is larger than 2 MB. Try a smaller PNG or SVG." }, { status: 413 });
  }
  let file: File | null = null;
  try {
    const form = await req.formData();
    const value = form.get("file");
    file = value instanceof File ? value : null;
  } catch {
    return NextResponse.json({ error: "The upload did not arrive in one piece. Try again." }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "That image is larger than 2 MB. Try a smaller PNG or SVG." }, { status: 413 });
  }
  try {
    const saved = await saveUpload(new Uint8Array(await file.arrayBuffer()));
    await audit(ctx.user.id, "upload.created", { type: "upload", id: saved.name }, { bytes: saved.bytes, type: saved.type });
    return NextResponse.json(saved, { status: 201 });
  } catch (err) {
    if (err instanceof UploadError) return NextResponse.json({ error: err.message }, { status: 415 });
    console.error("[uploads] save failed", err);
    return NextResponse.json({ error: "Lobby could not store the image. Check that the data directory is writable." }, { status: 500 });
  }
}
