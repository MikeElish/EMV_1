import { getMarkups } from "@/lib/price-settings";
import { getCbrExchangeRates } from "@/lib/cbr-exchange-rates";
import { getLogisticsSettings } from "@/lib/logistics";
import { PriceSettingsForm } from "@/components/admin/PriceSettingsForm";

export default async function PriceSettingsPage() {
  const [markups, cbrRates, logistics] = await Promise.all([getMarkups(), getCbrExchangeRates(), getLogisticsSettings()]);
  return <PriceSettingsForm markups={markups} cbrRates={cbrRates} logistics={logistics} />;
}
