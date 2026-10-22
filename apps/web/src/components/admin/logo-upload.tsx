"use client";

import { useRef, useState } from "react";
import { ImageUp, Trash2 } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

/** Uploads to /api/uploads and keeps the resulting URL in a hidden form field. */
export function LogoUpload({ name, companyName, defaultValue }: { name: string; companyName: string; defaultValue: string | null }) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setError(null);
    if (file.size > 2 * 1024 * 1024) {
      setError("That image is larger than 2 MB. Try a smaller PNG or SVG.");
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "The upload failed. Try again.");
      setUrl(json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The upload failed. Try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-small font-medium text-fg" id={`${name}-label`}>
        Logo
      </span>
      <div className="flex items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-card bg-sunken shadow-inset">
          <BrandMark name={companyName || "Lobby"} logoUrl={url || null} size={40} />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" loading={busy} onClick={() => input.current?.click()} aria-describedby={`${name}-help`}>
              <ImageUp aria-hidden />
              {url ? "Replace logo" : "Upload logo"}
            </Button>
            {url ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setUrl("")}>
                <Trash2 aria-hidden />
                Remove
              </Button>
            ) : null}
          </div>
          <p id={`${name}-help`} className="text-small text-muted">
            Square works best. PNG, SVG, JPEG or WebP, up to 2 MB. Without one, Lobby shows your initials.
          </p>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-small text-danger-text">
          {error}
        </p>
      ) : null}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
        className="sr-only"
        tabIndex={-1}
        aria-labelledby={`${name}-label`}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
      <input type="hidden" name={name} value={url} />
    </div>
  );
}
