"use client";

import { useEffect, useRef, useState } from "react";
import type { OrderDocument, OrderDocumentCategory } from "@prisma/client";
import { Modal } from "@/components/Modal";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { ORDER_DOCUMENT_CATEGORY_LABELS } from "@/lib/validators/orders";
import {
  listOrderDocuments,
  uploadOrderDocument,
  deleteOrderDocument,
} from "@/actions/admin/orders";

export function OrderDocumentsModal({
  orderId,
  category,
  onClose,
}: {
  orderId: string;
  category: OrderDocumentCategory;
  onClose: () => void;
}) {
  const [documents, setDocuments] = useState<OrderDocument[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function refresh() {
    listOrderDocuments(orderId, category).then(setDocuments);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, category]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.set("orderId", orderId);
    formData.set("category", category);
    formData.set("file", file);
    const result = await uploadOrderDocument(formData);
    setUploading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    refresh();
  }

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          aria-label="Загрузить файл"
          className="flex h-8 w-8 items-center justify-center rounded-md bg-green-600 text-lg font-bold leading-none text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          +
        </button>
        <h2 className="text-lg font-semibold">
          {ORDER_DOCUMENT_CATEGORY_LABELS[category]}
        </h2>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        className="hidden"
      />

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {uploading && <p className="mt-2 text-sm text-foreground/50">Загрузка...</p>}

      <div className="mt-4 space-y-2">
        {documents === null && (
          <p className="text-sm text-foreground/40">Загрузка списка...</p>
        )}
        {documents?.length === 0 && (
          <p className="text-sm text-foreground/40">Файлов пока нет.</p>
        )}
        {documents?.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between gap-3 rounded-md border border-foreground/10 px-3 py-2 text-sm"
          >
            <a
              href={doc.fileUrl}
              download={doc.fileName}
              className="min-w-0 flex-1 truncate hover:underline"
            >
              {doc.fileName}
            </a>
            <span className="shrink-0 text-xs text-foreground/40">
              {new Date(doc.uploadedAt).toLocaleDateString("ru-RU")}
            </span>
            <DeleteButton
              action={async () => {
                const result = await deleteOrderDocument(doc.id);
                if (result.ok) refresh();
                return result;
              }}
              confirmText={`Удалить файл «${doc.fileName}»?`}
              className="shrink-0 text-red-600 hover:underline disabled:opacity-50"
            />
          </div>
        ))}
      </div>
    </Modal>
  );
}
