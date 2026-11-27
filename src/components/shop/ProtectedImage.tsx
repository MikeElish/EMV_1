"use client";

export function ProtectedImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- external Blob URL, no next.config domain to wire up
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      onContextMenu={(e) => e.preventDefault()}
      className={className}
    />
  );
}
