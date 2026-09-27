import os from "os";
import { headers } from "next/headers";
import nextPkg from "next/package.json";

function formatDuration(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return [days && `${days} д`, hours && `${hours} ч`, `${minutes} мин`].filter(Boolean).join(" ");
}

function formatGb(bytes: number) {
  return `${(bytes / 1024 ** 3).toFixed(1)} ГБ`;
}

function databaseInfo() {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    return `${url.hostname}:${url.port || "5432"} / ${url.pathname.slice(1)}`;
  } catch {
    return "—";
  }
}

export default async function SiteSettingsPage() {
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "—";
  const protocol = headersList.get("x-forwarded-proto") ?? "http";

  const ipAddresses = Object.values(os.networkInterfaces())
    .flat()
    .filter((iface) => iface && iface.family === "IPv4" && !iface.internal)
    .map((iface) => iface!.address);

  const rows: [string, string][] = [
    ["Домен", host],
    ["Протокол", protocol === "https" ? "HTTPS" : "HTTP"],
    ["IP-адрес сервера", ipAddresses.join(", ") || "—"],
    ["Имя хоста", os.hostname()],
    ["Операционная система", `${os.type()} ${os.release()} (${os.arch()})`],
    ["Процессор", `${os.cpus().length} ядер`],
    ["Память", `${formatGb(os.totalmem() - os.freemem())} занято из ${formatGb(os.totalmem())}`],
    ["Сервер работает", formatDuration(os.uptime())],
    ["Приложение работает", formatDuration(process.uptime())],
    ["Node.js", process.version],
    ["Next.js", nextPkg.version],
    ["База данных", databaseInfo()],
    ["Каталог приложения", process.cwd()],
  ];

  return (
    <div>
      <h1 className="text-lg font-semibold">Сайт</h1>
      <dl className="mt-4 max-w-2xl divide-y divide-foreground/10 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[14rem_1fr] gap-4 py-2">
            <dt className="text-foreground/50">{label}</dt>
            <dd className="break-all">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
