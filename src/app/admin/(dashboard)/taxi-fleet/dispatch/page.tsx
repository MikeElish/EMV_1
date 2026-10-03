import { getDispatchData } from "@/actions/admin/dispatch";
import { DispatchBoard } from "@/components/admin/DispatchBoard";

export default async function CrmDispatchPage() {
  return <DispatchBoard initial={await getDispatchData()} />;
}
