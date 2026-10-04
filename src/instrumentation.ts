export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Summary letters about changed order lines, every 5 minutes.
    const { startLineStatusDigestTimer } = await import("@/lib/order-notifications");
    startLineStatusDigestTimer();
    // Почта: «Правила обработки писем» for new letters, every minute.
    const { startMailRulesTimer } = await import("@/lib/mail/rules");
    startMailRulesTimer();
  }
}
