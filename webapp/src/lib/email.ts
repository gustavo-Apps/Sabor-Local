// Envio de e-mails do próprio site (hoje só o convite de avaliação). Sem dependências: chama a API do Resend com fetch.
//
// Variáveis de ambiente (servidor):
//   RESEND_API_KEY     chave da conta no Resend (https://resend.com)
//   EMAIL_REMETENTE    quem aparece como remetente, ex.: Sabor Local <avisos@seudominio.com.br> (domínio verificado)
//   RESEND_API_URL     (opcional) outro endereço da API, só para testes com um servidor falso
//
// Sem essas variáveis: em desenvolvimento o e-mail é só impresso no terminal do servidor ("modo log");
// em produção o envio é recusado e a tela avisa que o recurso não está configurado.

export interface EmailParaEnviar {
  para: string;
  assunto: string;
  texto: string;
  html?: string;
}

export type ResultadoEnvio = { ok: true; modo: "resend" | "log" } | { ok: false; erro: "nao_configurado" | "falha_no_envio" };

export function emailConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_REMETENTE?.trim());
}

/** Em desenvolvimento sem chave, o convite "sai" no terminal; em produção, não. */
export function podeSimularEmail(): boolean {
  return process.env.NODE_ENV !== "production";
}

export async function enviarEmail(msg: EmailParaEnviar): Promise<ResultadoEnvio> {
  if (emailConfigurado()) {
    try {
      const resposta = await fetch(process.env.RESEND_API_URL?.trim() || "https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.EMAIL_REMETENTE,
          to: [msg.para],
          subject: msg.assunto,
          text: msg.texto,
          ...(msg.html ? { html: msg.html } : {}),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      return resposta.ok ? { ok: true, modo: "resend" } : { ok: false, erro: "falha_no_envio" };
    } catch {
      return { ok: false, erro: "falha_no_envio" };
    }
  }

  if (podeSimularEmail()) {
    console.info(`[e-mail simulado] para: ${msg.para}\nassunto: ${msg.assunto}\n${msg.texto}`);
    return { ok: true, modo: "log" };
  }
  return { ok: false, erro: "nao_configurado" };
}

const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Texto e HTML do convite. O link é o único lugar onde o token aparece. */
export function montarConviteDeAvaliacao(nomeDaLoja: string, link: string): { assunto: string; texto: string; html: string } {
  const assunto = `Conte como foi seu pedido na ${nomeDaLoja}`;
  const texto = [
    `Olá! A ${nomeDaLoja} convidou você para avaliar o seu pedido.`,
    "",
    `Abra este link para dar sua nota e deixar um comentário (leva menos de um minuto):`,
    link,
    "",
    "O link é só seu e vale por 30 dias. Não compartilhe com ninguém.",
    "Se você não fez um pedido nessa loja, pode ignorar este e-mail.",
    "",
    "Sabor Local",
  ].join("\n");
  const html = `<!doctype html><html lang="pt-BR"><body style="font-family:Arial,Helvetica,sans-serif;color:#18181b;line-height:1.5">
<p>Olá! A <strong>${escapar(nomeDaLoja)}</strong> convidou você para avaliar o seu pedido.</p>
<p><a href="${escapar(link)}" style="display:inline-block;background:#ea580c;color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:999px">Avaliar meu pedido</a></p>
<p style="font-size:13px;color:#52525b">O link é só seu e vale por 30 dias. Não compartilhe com ninguém. Se você não fez um pedido nessa loja, pode ignorar este e-mail.</p>
<p style="font-size:12px;color:#71717a">Sabor Local</p></body></html>`;
  return { assunto, texto, html };
}
