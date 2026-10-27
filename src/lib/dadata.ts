import "server-only";

// DaData «Организация по ИНН» (findById/party): the company card fills its
// name, КПП, ОГРН and address from ЕГРЮЛ/ЕГРИП. Free up to 10 000 requests a day.
const URL = "https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party";

export type PartyStatus = "ACTIVE" | "LIQUIDATING" | "LIQUIDATED" | "BANKRUPT" | "REORGANIZING";

export type Party = {
  name: string;
  kpp: string | null;
  ogrn: string | null;
  address: string | null;
  individual: boolean;
  status: PartyStatus | null;
};

type DadataParty = {
  value: string;
  data: {
    kpp?: string | null;
    ogrn?: string | null;
    type?: "LEGAL" | "INDIVIDUAL";
    name?: { short_with_opf?: string | null; full_with_opf?: string | null };
    address?: { unrestricted_value?: string | null; value?: string | null } | null;
    state?: { status?: PartyStatus | null } | null;
  };
};

export class DadataError extends Error {}

/** The head organisation (or ИП) with this ИНН; null when ЕГРЮЛ/ЕГРИП has none. */
export async function findPartyByInn(inn: string): Promise<Party | null> {
  const key = process.env.DADATA_API_KEY;
  if (!key) throw new DadataError("Автозаполнение по ИНН не подключено: на сервере не задан ключ DaData.");

  const response = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Token ${key}` },
    body: JSON.stringify({ query: inn, branch_type: "MAIN", count: 1 }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  }).catch(() => {
    throw new DadataError("Сервис DaData не ответил. Попробуйте ещё раз или заполните вручную.");
  });
  if (response.status === 401 || response.status === 403) throw new DadataError("DaData отклонила ключ — проверьте его в настройках сервера.");
  if (response.status === 429) throw new DadataError("Превышен дневной лимит запросов DaData.");
  if (!response.ok) throw new DadataError(`DaData вернула ошибку ${response.status}.`);

  const { suggestions } = (await response.json()) as { suggestions: DadataParty[] };
  const party = suggestions[0];
  if (!party) return null;
  const { data } = party;
  return {
    name: data.name?.short_with_opf || party.value,
    kpp: data.kpp || null,
    ogrn: data.ogrn || null,
    address: data.address?.unrestricted_value || data.address?.value || null,
    individual: data.type === "INDIVIDUAL",
    status: data.state?.status ?? null,
  };
}
