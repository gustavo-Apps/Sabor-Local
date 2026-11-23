// Dados dos textos legais. A versão muda sempre que os Termos ou a Política forem alterados
// de forma relevante: ela é gravada no cadastro (perfis_vendedor.termos_versao). Ao mudar o valor abaixo, todo vendedor
// vê uma tela pedindo novo aceite no próximo acesso ao painel.

export const TERMOS_VERSAO = "2026-10-pedidos";
export const TERMOS_DATA = "outubro de 2026";

/** Quem responde pelo site. Configure em produção (variáveis NEXT_PUBLIC_*). */
export function responsavel() {
  const whatsapp = (process.env.NEXT_PUBLIC_CONTATO_WHATSAPP ?? "").replace(/\D/g, "");
  return {
    nome: process.env.NEXT_PUBLIC_RESPONSAVEL_NOME?.trim() || "equipe do Sabor Local",
    email: process.env.NEXT_PUBLIC_CONTATO_EMAIL?.trim() || null,
    whatsapp: whatsapp || null,
    github: "https://github.com/gustavo-Apps",
  };
}
