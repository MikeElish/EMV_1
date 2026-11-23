import { requireSection } from "@/lib/access-server";
import { TasksClient } from "@/components/admin/TasksClient";
import { listTasks, listEmployees } from "@/actions/crm/tasks";

export default async function TasksPage() {
  await requireSection("tasks", "view");
  const [tasks, employees] = await Promise.all([listTasks(), listEmployees()]);
  return (
    <TasksClient
      initialTasks={tasks.ok ? tasks.tasks : []}
      initialEmployees={employees.ok ? employees.employees : []}
      error={!tasks.ok ? tasks.error : !employees.ok ? employees.error : null}
    />
  );
}
