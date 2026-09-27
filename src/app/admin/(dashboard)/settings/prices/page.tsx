import { getMarkups } from "@/lib/price-settings";
import { PriceSettingsForm } from "@/components/admin/PriceSettingsForm";

export default async function PriceSettingsPage() {
  const markups = await getMarkups();
  return <PriceSettingsForm markups={markups} />;
}
