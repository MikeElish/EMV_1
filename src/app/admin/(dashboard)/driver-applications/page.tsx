import { prisma } from "@/lib/prisma";
import { ContactedToggle } from "@/components/admin/ContactedToggle";

export default async function DriverApplicationsPage() {
  const applications = await prisma.driverApplication.findMany({
    orderBy: { createdAt: "desc" },
  });

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
            <tr key={application.id} className="border-b border-foreground/10">
              <td className="py-2 font-medium">{application.name}</td>
              <td className="py-2">
                <a
                  href={`tel:${application.phone}`}
                  className="hover:underline"
                >
                  {application.phone}
                </a>
              </td>
              <td className="py-2">
                {application.drivingExperienceYears ?? "—"}
              </td>
              <td className="py-2">
                {application.previousDriverExperience ? "Да" : "Нет"}
              </td>
              <td className="py-2">
                <ContactedToggle
                  applicationId={application.id}
                  contacted={application.status === "CONTACTED"}
                />
              </td>
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
    </div>
  );
}
