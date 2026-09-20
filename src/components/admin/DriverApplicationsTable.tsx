"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DriverApplication } from "@prisma/client";
import {
  updateDriverApplication,
  deleteDriverApplication,
} from "@/actions/admin/driver-applications";
import { DriverApplicationForm } from "@/components/admin/DriverApplicationForm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { Modal } from "@/components/Modal";

const STATUS_LABELS: Record<DriverApplication["status"], string> = {
  NEW: "Новая",
  CONTACTED: "Связались",
};

export function DriverApplicationsTable({
  applications,
}: {
  applications: DriverApplication[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<DriverApplication | null>(null);

  function close() {
    setSelected(null);
    router.refresh();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Заявки водителей</h1>

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-foreground/10 text-left text-foreground/50">
            <th className="py-2">Имя</th>
            <th className="py-2">Телефон</th>
            <th className="py-2">Стаж</th>
            <th className="py-2">Работал водителем</th>
            <th className="py-2">Статус</th>
            <th className="py-2">Дата</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((application) => (
            <tr
              key={application.id}
              onClick={() => setSelected(application)}
              className="cursor-pointer border-b border-foreground/10 hover:bg-foreground/5"
            >
              <td className="py-2 font-medium">{application.name}</td>
              <td className="py-2">
                <a
                  href={`tel:${application.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="hover:underline"
                >
                  {application.phone}
                </a>
              </td>
              <td className="py-2">{application.drivingExperienceYears ?? "—"}</td>
              <td className="py-2">
                {application.previousDriverExperience ? "Да" : "Нет"}
              </td>
              <td className="py-2">{STATUS_LABELS[application.status]}</td>
              <td className="py-2 text-foreground/50">
                {application.createdAt.toLocaleDateString("ru-RU")}
              </td>
            </tr>
          ))}
          {applications.length === 0 && (
            <tr>
              <td colSpan={6} className="py-8 text-center text-foreground/50">
                Пока нет заявок
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {selected && (
        <Modal onClose={() => setSelected(null)} maxWidthClassName="max-w-xl">
          <h2 className="text-xl font-bold">Заявка: {selected.name}</h2>
          <DriverApplicationForm
            initial={{
              name: selected.name,
              phone: selected.phone,
              drivingExperienceYears: selected.drivingExperienceYears ?? undefined,
              previousDriverExperience: selected.previousDriverExperience,
              status: selected.status,
            }}
            onSubmit={(input) => updateDriverApplication(selected.id, input)}
            onSuccess={close}
          />

          <div className="mt-6 flex justify-end">
            <DeleteButton
              action={async () => {
                const result = await deleteDriverApplication(selected.id);
                if (result.ok) close();
                return result;
              }}
              confirmText={`Удалить заявку «${selected.name}»?`}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
