import { verifyStaffSession } from "@/lib/staff-dal";
import { OpenLastMailPlace } from "@/components/mail/LastMailPlace";

// Почта → the folder / letter the employee left it on; the first time, Входящие.
export default async function AdminMailPage() {
  const { userId } = await verifyStaffSession();
  return <OpenLastMailPlace userId={userId} />;
}
