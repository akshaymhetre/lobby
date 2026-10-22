import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

/** Images only, 2 MB at most. */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export const UPLOAD_TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
} as const;
export type UploadExt = keyof typeof UPLOAD_TYPES;

/** Content-addressed file names: a sha256 prefix and an extension. Nothing else is ever served. */
const NAME_RE = /^[a-f0-9]{32}\.(png|jpg|gif|webp|svg)$/;

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

/** `LOBBY_DATA_DIR`, or `<repo>/data` in development. */
export function dataDir(): string {
  return process.env.LOBBY_DATA_DIR ?? path.join(findRepoRoot(process.cwd()), "data");
}

export const uploadsDir = () => path.join(dataDir(), "uploads");

/**
 * Decides the real type from the bytes, never from the file name or the browser's claim.
 * Returns null for anything that is not one of the accepted image formats.
 */
export function sniffImage(buf: Uint8Array): UploadExt | null {
  const b = buf;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "gif";
  if (
    b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) return "webp";
  const head = Buffer.from(b.subarray(0, 1024)).toString("utf8").replace(/^﻿/, "").trimStart().toLowerCase();
  if ((head.startsWith("<svg") || head.startsWith("<?xml")) && head.includes("<svg")) return "svg";
  return null;
}

export class UploadError extends Error {}

export async function saveUpload(buf: Uint8Array): Promise<{ name: string; url: string; type: string; bytes: number }> {
  if (buf.byteLength === 0) throw new UploadError("That file is empty.");
  if (buf.byteLength > MAX_UPLOAD_BYTES) throw new UploadError("That image is larger than 2 MB. Try a smaller PNG or SVG.");
  const ext = sniffImage(buf);
  if (!ext) throw new UploadError("Only PNG, JPEG, GIF, WebP and SVG images can be uploaded.");
  const name = `${createHash("sha256").update(buf).digest("hex").slice(0, 32)}.${ext}`;
  await mkdir(uploadsDir(), { recursive: true });
  await writeFile(path.join(uploadsDir(), name), buf);
  return { name, url: `/api/uploads/${name}`, type: UPLOAD_TYPES[ext], bytes: buf.byteLength };
}

export function isUploadName(name: string): boolean {
  return NAME_RE.test(name);
}

export async function readUpload(name: string): Promise<{ data: Buffer; type: string; mtime: Date } | null> {
  if (!isUploadName(name)) return null;
  const file = path.join(uploadsDir(), name);
  try {
    const [data, info] = await Promise.all([readFile(file), stat(file)]);
    if (data.byteLength > MAX_UPLOAD_BYTES) return null;
    const ext = name.split(".").pop() as UploadExt;
    return { data, type: UPLOAD_TYPES[ext], mtime: info.mtime };
  } catch {
    return null;
  }
}
