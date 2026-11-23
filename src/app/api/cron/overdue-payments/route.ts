import { NextResponse } from "next/server";
import { createOverduePaymentTasks } from "@/lib/task-automation";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (secret && token !== secret) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  try {
    const created = await createOverduePaymentTasks();
    return NextResponse.json({ ok: true, created });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
