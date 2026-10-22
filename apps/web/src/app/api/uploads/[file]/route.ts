import { NextResponse, type NextRequest } from "next/server";
import { readUpload } from "@lobby/core/admin";

/**
 * Serves uploaded images. Public, because the logo appears on the sign-in page.
 * Names are content hashes, so responses are immutable. SVGs are sandboxed so a script inside
 * one can never run, even when opened directly.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const upload = await readUpload(file);
  if (!upload) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(upload.data), {
    headers: {
      "Content-Type": upload.type,
      "Content-Length": String(upload.data.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",
      "Content-Disposition": "inline",
    },
  });
}
