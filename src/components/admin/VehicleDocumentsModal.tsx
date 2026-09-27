"use client";

import { useEffect, useRef, useState } from "react";
import type { VehicleDocument } from "@prisma/client";
import { Modal } from "@/components/Modal";
import { DeleteButton } from "@/components/admin/DeleteButton";
import {
  listVehicleDocuments,
  uploadVehicleDocument,
  deleteVehicleDocument,
} from "@/actions/admin/vehicles";

export function VehicleDocumentsModal({
  vehicleId,
  vehicleName,
  onClose,
}: {
  vehicleId: string;
  vehicleName: string;
  onClose: () => void;
}) {
  const [documents, setDocuments] = useState<VehicleDocument[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function refresh() {
    listVehicleDocuments(vehicleId).then(setDocuments);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.set("vehicleId", vehicleId);
    formData.set("file", file);
    const result = await uploadVehicleDocument(formData);
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
        <h2 className="text-lg font-semibold">Файлы: {vehicleName}</h2>
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
                const result = await deleteVehicleDocument(doc.id);
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
