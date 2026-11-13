import { getMarkups } from "@/lib/price-settings";
import { getCbrExchangeRates } from "@/lib/cbr-exchange-rates";
import { PriceSettingsForm } from "@/components/admin/PriceSettingsForm";

export default async function PriceSettingsPage() {
  const [markups, cbrRates] = await Promise.all([getMarkups(), getCbrExchangeRates()]);
  return <PriceSettingsForm markups={markups} cbrRates={cbrRates} />;
}
