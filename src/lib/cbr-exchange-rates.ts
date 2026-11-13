import "server-only";

export type CbrRates = {
  USD: number | null;
  EUR: number | null;
  CNY: number | null;
};

export async function getCbrExchangeRates(): Promise<CbrRates> {
  try {
    const response = await fetch("https://www.cbr-xml-daily.ru/daily_json.js", {
      next: { revalidate: 3600 },
    });
    if (!response.ok) throw new Error(`CBR status ${response.status}`);
    const data = (await response.json()) as {
      Valute?: Record<string, { Value: number; Nominal: number }>;
    };
    const valute = data.Valute ?? {};
    return {
      USD: valute.USD ? valute.USD.Value / valute.USD.Nominal : null,
      EUR: valute.EUR ? valute.EUR.Value / valute.EUR.Nominal : null,
      CNY: valute.CNY ? valute.CNY.Value / valute.CNY.Nominal : null,
    };
  } catch (error) {
    console.error("[cbr-exchange-rates] failed", error);
    return { USD: null, EUR: null, CNY: null };
  }
}
