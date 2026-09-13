"use client";

import { useRef, useState } from "react";
import { uploadProductImage, removeProductImage } from "@/actions/admin/upload-image";

export function ProductImagesField({
  images,
  onChange,
}: {
  images: string[];
  onChange: (images: string[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadProductImage(formData);
      if (result.ok) {
        onChange([...images, result.url]);
      } else {
        setError(result.error);
      }
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleRemove(url: string) {
    onChange(images.filter((img) => img !== url));
    void removeProductImage(url);
  }

  return (
    <div>
      <label className="text-sm text-foreground/60">Фото товара</label>
      <p className="mt-1 text-xs text-foreground/40">
        На загруженные фото автоматически наносится водяной знак EMV / emv.one.
      </p>

      {images.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-3">
          {images.map((url) => (
            <div key={url} className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-md border border-foreground/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => handleRemove(url)}
                aria-label="Удалить фото"
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        disabled={uploading}
        onChange={(e) => handleFiles(e.target.files)}
        className="mt-2 text-sm"
      />
      {uploading && <p className="mt-1 text-xs text-foreground/40">Загружаем и наносим водяной знак...</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
