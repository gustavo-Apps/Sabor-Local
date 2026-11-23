// Links para o vendedor divulgar o perfil, com a origem marcada. Sem dependências, para rodar no servidor e nos testes.

export const ORIGENS = ["whatsapp", "facebook", "instagram", "link", "qr"] as const;
export type Origem = (typeof ORIGENS)[number];

export const ROTULOS_ORIGEM: Record<Origem | "direto", string> = {
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  instagram: "Instagram",
  link: "Link copiado ou outros apps",
  qr: "QR code",
  direto: "Direto (sem origem)",
};

/** Só aceita as origens conhecidas; o resto vira nulo (e o banco também ignora). */
export function origemValida(valor: string | null | undefined): Origem | null {
  return ORIGENS.find((o) => o === valor) ?? null;
}

/** Endereço do perfil, com a origem quando houver. `base` é o endereço do site, sem barra no fim. */
export function linkDoPerfil(base: string, vendedorId: string, origem?: Origem | null): string {
  const url = `${base.replace(/\/+$/, "")}/vendedores/${vendedorId}`;
  return origem ? `${url}?origem=${origem}` : url;
}

export function mensagemPadrao(nomeDoNegocio: string): string {
  return `Faça seu pedido na ${nomeDoNegocio}! Veja o cardápio e chame no WhatsApp:`;
}

/** wa.me sem número: abre a lista de contatos para o vendedor escolher com quem compartilhar. */
export function linkWhatsApp(mensagem: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${mensagem.trim()} ${url}`.trim())}`;
}

export function linkFacebook(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}
