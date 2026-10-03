export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Summary letters about changed order lines, every 5 minutes.
    const { startLineStatusDigestTimer } = await import("@/lib/order-notifications");
    startLineStatusDigestTimer();
  }
}
