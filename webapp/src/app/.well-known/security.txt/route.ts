import { responsavel } from "@/lib/legal";
import { REPOSITORIO } from "@/lib/feedback";

export const dynamic = "force-dynamic";

// security.txt (RFC 9116): onde reportar uma falha de segurança. Só existe quando há e-mail de contato configurado.
export async function GET() {
  const { email } = responsavel();
  if (!email) return new Response("Not found", { status: 404 });

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const expira = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
  const corpo = [
    `Contact: mailto:${email}`,
    `Expires: ${expira}`,
    "Preferred-Languages: pt, en",
    `Canonical: ${site}/.well-known/security.txt`,
    `Policy: ${REPOSITORIO}/blob/main/SECURITY.md`,
    "",
  ].join("\n");

  return new Response(corpo, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
