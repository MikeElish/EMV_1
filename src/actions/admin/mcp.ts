"use server";

import { redirect } from "next/navigation";
import { getMyAccess } from "@/lib/access-server";
import { issueCode, readClient } from "@/lib/mcp/auth";

/** «Разрешить» / «Отказать» on /admin/connect: back to Claude with a code or a refusal. */
export async function answerConnection(formData: FormData) {
  const field = (name: string) => String(formData.get(name) ?? "");
  const clientId = field("client_id");
  const redirectUri = field("redirect_uri");
  const client = await readClient(clientId);
  if (!client?.redirectUris.includes(redirectUri)) redirect("/admin");

  const back = new URL(redirectUri);
  if (field("state")) back.searchParams.set("state", field("state"));
  const me = await getMyAccess();
  if (field("answer") !== "allow" || me?.role !== "OWNER") {
    back.searchParams.set("error", "access_denied");
  } else {
    back.searchParams.set("code", await issueCode({ userId: me.userId, clientId, redirectUri, challenge: field("code_challenge") }));
  }
  redirect(back.toString());
}
