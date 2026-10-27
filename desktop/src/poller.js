// Once a minute asks the site (/api/desktop/poll, with the window's cookies)
// what is new, and shows Windows notifications for new orders and letters.
const { session } = require("electron");
const settings = require("./settings");

const INTERVAL_MS = 60_000;

/**
 * @param {{
 *   baseUrl: string,
 *   notify: (n: { title: string, body: string, path: string }) => void,
 *   onState: (s: { signedIn: boolean, unread: number | null }) => void,
 *   onSuppliers: (names: string[]) => void,
 * }} opts
 */
function start(opts) {
  // Cursors from the server's previous answer; null = first call, nothing is announced.
  let ordersSince = null;
  let mailCursor = null; // { folder path: "validity:uid" } from the site
  let busy = false;

  async function poll() {
    if (busy) return;
    busy = true;
    try {
      const q = new URLSearchParams();
      if (ordersSince) q.set("ordersSince", ordersSince);
      if (mailCursor) q.set("mail", JSON.stringify(mailCursor));
      const res = await session.defaultSession.fetch(`${opts.baseUrl}/api/desktop/poll?${q}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok || !(res.headers.get("content-type") || "").includes("json")) return;
      const data = await res.json();
      if (!data.signedIn) {
        ordersSince = mailCursor = null;
        opts.onState({ signedIn: false, unread: null });
        return;
      }
      const s = settings.get();

      if (ordersSince && s.notifyOrders) {
        for (const o of data.orders || []) {
          opts.notify({
            title: `Новый заказ ${o.orderNumber}`,
            body: `${o.customerName} · ${o.total}`,
            path: `/admin/crm/orders?orderNumber=${encodeURIComponent(o.orderNumber)}`,
          });
        }
      }
      ordersSince = data.ordersSince;

      const mail = data.mail;
      // Входящие and Мои папки (Yandex filters often file letters straight into a folder).
      if (mail) {
        if (mailCursor && s.notifyMail) {
          for (const l of mail.letters || []) {
            opts.notify({ title: `Письмо · ${l.folder}`, body: `${l.from || "без отправителя"}\n${l.subject}`, path: l.url });
          }
        }
        mailCursor = mail.cursor;
      }
      opts.onState({ signedIn: true, unread: mail ? mail.unread : null });
      if (Array.isArray(data.suppliers)) opts.onSuppliers(data.suppliers);
    } catch {
      // offline or the site is restarting -- next minute
    } finally {
      busy = false;
    }
  }

  setTimeout(poll, 5_000);
  setInterval(poll, INTERVAL_MS);
  return { pollNow: poll };
}

module.exports = { start };
