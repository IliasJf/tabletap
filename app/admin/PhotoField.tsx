"use client";

import { useRef, useState } from "react";
import { ImageUp, Link2 } from "lucide-react";
import { MAX_IMAGE_BYTES } from "../../lib/images";

const MAX_EDGE = 1200;

/** Shrinks a phone photo to a menu-sized JPEG before it leaves the browser. */
async function resizePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.85, 0.75, 0.6, 0.45]) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (blob && blob.size <= MAX_IMAGE_BYTES) return blob;
  }
  throw new Error("This photo is too detailed to upload. Try another one.");
}

export default function PhotoField({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [showLink, setShowLink] = useState(
    () => !value.startsWith("/api/images/") && !value.startsWith("/images/"),
  );

  async function upload(file: File) {
    setError("");
    setUploading(true);
    try {
      const photo = await resizePhoto(file);
      const response = await fetch("/api/admin/images", {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: photo,
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url)
        throw new Error(data.error || "The photo could not be uploaded.");
      onChange(data.url);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "The photo could not be uploaded. Try a JPEG or PNG.",
      );
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="admin-field admin-photo-field">
      <span>Photo</span>
      <div className="admin-photo-actions">
        <button
          type="button"
          className="admin-secondary"
          onClick={() => input.current?.click()}
          disabled={uploading}
        >
          <ImageUp size={16} />
          {uploading ? "Uploading…" : "Upload a photo"}
        </button>
        <button
          type="button"
          className="admin-text-button"
          onClick={() => setShowLink((open) => !open)}
          aria-expanded={showLink}
        >
          <Link2 size={15} />
          Use a link instead
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      {showLink && (
        <input
          aria-label="Photo link"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
        />
      )}
      {error ? (
        <small className="admin-error" role="alert">
          {error}
        </small>
      ) : (
        <small>
          Take or choose a photo. We resize it for the menu. Save your menu to
          publish it.
        </small>
      )}
    </div>
  );
}
