import { getMyAccess } from "@/lib/access-server";
import { readClient } from "@/lib/mcp/auth";
import { answerConnection } from "@/actions/admin/mcp";

// OAuth authorization page of the Claude connector (src/lib/mcp/auth.ts).
// The proxy has already sent a signed-out visitor to the login.

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-lg border border-foreground/10 p-8">
        <h1 className="text-xl font-bold">{title}</h1>
        {children}
      </div>
    </main>
  );
}

export default async function ConnectPage({ searchParams }: PageProps<"/admin/connect">) {
  const params = await searchParams;
  const field = (name: string) => (typeof params[name] === "string" ? (params[name] as string) : "");
  const client = await readClient(field("client_id"));
  const redirectUri = field("redirect_uri");

  let problem: string | null = null;
  if (!client || !client.redirectUris.includes(redirectUri)) problem = "Ссылка подключения неверна. Начните подключение в Claude заново.";
  else if (field("response_type") !== "code" || field("code_challenge_method") !== "S256" || !field("code_challenge"))
    problem = "Приложение запросило неподдерживаемый способ входа.";
  else if ((await getMyAccess())?.role !== "OWNER") problem = "Подключить Claude к сайту может только владелец.";
  if (problem) {
    return (
      <Box title="Подключение Claude">
        <p className="mt-3 text-sm text-red-600">{problem}</p>
      </Box>
    );
  }

  return (
    <Box title="Подключить Claude к сайту?">
      <p className="mt-3 text-sm text-foreground/70">
        «{client!.name}» получит от вашего имени доступ к товарам, клиентам, заказам и складу: сможет искать, создавать заказы,
        менять их статусы и карточки товаров.
      </p>
      <p className="mt-2 text-xs text-foreground/50">Вернётся на {new URL(redirectUri).host}</p>
      <form action={answerConnection} className="mt-6 flex gap-3">
        {["client_id", "redirect_uri", "state", "code_challenge"].map((name) => (
          <input key={name} type="hidden" name={name} value={field(name)} />
        ))}
        <button
          name="answer"
          value="allow"
          className="flex-1 rounded-md bg-foreground px-4 py-2.5 font-medium text-background hover:opacity-90"
        >
          Разрешить
        </button>
        <button name="answer" value="deny" className="flex-1 rounded-md border border-foreground/20 px-4 py-2.5 hover:bg-foreground/5">
          Отказать
        </button>
      </form>
    </Box>
  );
}
