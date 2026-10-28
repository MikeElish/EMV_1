export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Summary letters about changed order lines, every 5 minutes.
    const { startLineStatusDigestTimer } = await import("@/lib/order-notifications");
    startLineStatusDigestTimer();
    // Почта: «Правила обработки писем» for new letters, every minute.
    const { startMailRulesTimer } = await import("@/lib/mail/rules");
    startMailRulesTimer();
    // Наличие товаров из остатков 1С, at 06:00 and 18:00 Moscow time.
    const { startOneCStockTimer } = await import("@/lib/onec-stock");
    startOneCStockTimer();
    // Проценка по почте: replies, reminders, summaries, every half hour.
    const { startPriceRequestTimer } = await import("@/lib/price-requests");
    startPriceRequestTimer();
    // Банки: Точка's statement at 10:00, 14:00 and 20:00 Moscow time.
    const { startBankTimer } = await import("@/lib/banks");
    startBankTimer();
    // Заказ поставщику: agreed lines go out, invoices come in, every half hour.
    const { startSupplierPurchaseTimer } = await import("@/lib/supplier-purchases");
    startSupplierPurchaseTimer();
  }
}
