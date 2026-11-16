"use client";

export function isPreviewableDocument(name: string): boolean {
  return /\.(pdf|png|jpe?g|gif|webp|svg|txt|html?)$/i.test(name);
}

export function DocumentFileLink({
  fileUrl,
  fileName,
  className = "min-w-0 flex-1 truncate hover:underline",
  onClick,
  forcePreview = false,
}: {
  fileUrl: string;
  fileName: string;
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  /** Always open in a new tab (view mode) instead of downloading. */
  forcePreview?: boolean;
}) {
  const previewable = forcePreview || isPreviewableDocument(fileName);
  return (
    <a
      href={fileUrl}
      {...(previewable
        ? { target: "_blank", rel: "noopener noreferrer" }
        : { download: fileName })}
      className={className}
      title={previewable ? "Открыть для просмотра" : "Скачать файл"}
      onClick={onClick}
    >
      {fileName}
    </a>
  );
}
