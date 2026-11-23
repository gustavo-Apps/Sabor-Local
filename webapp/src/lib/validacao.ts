// Regras de validação e máscaras, sem dependências, para rodar no servidor, no
// navegador e nos testes (tests/). Toda mensagem é escrita para o usuário
// corrigir o campo: diz o que está errado e como deve ser.

import type { ResumoCidade } from "./metas";
import type { ContagemFeedback } from "./feedback";

export type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: string };

const falha = (erro: string): { ok: false; erro: string } => ({ ok: false, erro });
const certo = <T>(valor: T): Resultado<T> => ({ ok: true, valor });

export const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
export const DATA = /^\d{4}-\d{2}-\d{2}$/;
export const USERNAME = /^[a-z0-9_.]{3,30}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MODOS = ["entrega", "retirada", "ambos"];
const NOMES_DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

// ---------------------------------------------------------------------------
// Utilitários e máscaras
// ---------------------------------------------------------------------------

export const somenteDigitos = (valor: string) => valor.replace(/\D/g, "");

/** Máscara progressiva: "11999990000" -> "(11) 99999-0000". Aceita colar com +55. */
export function mascararWhatsApp(valor: string): string {
  let d = somenteDigitos(valor);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  const meio = d.length > 10 ? 7 : 6;
  if (d.length <= meio) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, meio)}-${d.slice(meio)}`;
}

/** Devolve só dígitos com 55 na frente (12 ou 13 dígitos) ou null se for inválido. */
export function normalizarWhatsApp(valor: string): string | null {
  let d = somenteDigitos(valor);
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (!/^55\d{10,11}$/.test(d)) return null;
  const ddd = Number(d.slice(2, 4));
  if (ddd < 11 || ddd > 99) return null;
  return d;
}

export function lerPreco(bruto: string): number | null | "invalido" {
  if (!bruto.trim()) return null;
  const texto = bruto.trim().replace(/^R\$\s*/i, "");
  if (!texto) return "invalido"; // só "R$", sem número
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+([.,]\d{1,2})?$/.test(texto)) return "invalido";
  const normalizado = texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto;
  const n = Number(normalizado);
  return Number.isFinite(n) && n >= 0 && n <= 99999 ? Math.round(n * 100) / 100 : "invalido";
}

export function somarDias(data: string, dias: number) {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function dataExiste(data: string) {
  if (!DATA.test(data)) return false;
  const d = new Date(`${data}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === data;
}

// ---------------------------------------------------------------------------
// Cadastro e login
// ---------------------------------------------------------------------------

export function validarCadastro(d: {
  email: string;
  username: string;
  senha: string;
  categoriaIds: string[];
  aceitouTermos: boolean;
}): Resultado<{ email: string; username: string }> {
  const email = d.email.trim().toLowerCase();
  const username = d.username.trim().toLowerCase();

  if (!email) return falha("Digite seu e-mail.");
  if (email.length > 254 || !EMAIL.test(email)) return falha("E-mail inválido. Use o formato nome@email.com.");
  if (!username) return falha("Escolha um nome de usuário.");
  if (!USERNAME.test(username)) {
    return falha("Usuário: de 3 a 30 caracteres, só letras minúsculas, números, ponto (.) e sublinhado (_). Sem espaços.");
  }
  if (d.senha.length < 8) return falha("A senha precisa ter pelo menos 8 caracteres.");
  if (d.senha.length > 72) return falha("A senha pode ter no máximo 72 caracteres.");
  if (d.senha.toLowerCase() === username) return falha("A senha não pode ser igual ao usuário.");
  if (d.categoriaIds.length === 0) return falha("Escolha pelo menos um ramo do seu negócio.");
  if (!d.aceitouTermos) {
    return falha("Para criar a conta, marque que você leu e aceita os Termos de Uso e a Política de Privacidade.");
  }
  return certo({ email, username });
}

/** "Esqueci minha senha": aceita e-mail ou usuário e devolve o texto limpo (minúsculo, sem espaços nas pontas). */
export function validarRecuperacao(identificador: string): Resultado<string> {
  const id = identificador.trim().toLowerCase();
  if (!id) return falha("Digite seu e-mail ou usuário.");
  if (id.length > 254) return falha("Esse e-mail ou usuário é longo demais.");
  if (id.includes("@") ? !EMAIL.test(id) : !USERNAME.test(id)) {
    return falha("Use o e-mail completo (nome@email.com) ou o seu usuário, sem espaços.");
  }
  return certo(id);
}

/** Nova senha escolhida na redefinição: mesmas regras do cadastro, com confirmação. */
export function validarNovaSenha(senha: string, confirmacao: string): string | null {
  if (senha.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (senha.length > 72) return "A senha pode ter no máximo 72 caracteres.";
  if (!/\S/.test(senha)) return "A senha não pode ser só espaços.";
  if (senha !== confirmacao) return "As duas senhas não são iguais.";
  return null;
}

export function validarLogin(identificador: string, senha: string): string | null {
  if (!identificador.trim()) return "Digite seu usuário ou e-mail.";
  if (!senha) return "Digite sua senha.";
  if (identificador.length > 254 || senha.length > 72) return "Usuário/e-mail ou senha incorretos.";
  return null;
}

// ---------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------

/** Valor da opção "Não achei meu bairro" no seletor: quem escolhe digita o nome e ele vai para a fila do administrador. */
export const BAIRRO_OUTRO = "__outro";

export function validarPerfil(d: {
  nome: string;
  descricao: string;
  whatsapp: string;
  modo: string;
  bairroId: string;
  /** Nome digitado em "Não achei meu bairro". Só vale quando o bairro da lista não foi escolhido. */
  bairroNovo?: string;
  categoriaIds: string[];
  /** Link de pedidos próprio (opcional). Se for omitido, o perfil não mexe nesses campos. */
  linkPedido?: string;
  linkRotulo?: string;
}): Resultado<{
  nome: string;
  descricao: string | null;
  whatsapp: string;
  modo_atendimento: string;
  /** Ausente quando o vendedor sugeriu um bairro novo (veja `bairro_novo`). */
  bairro_id?: string;
  /** Sugestão de bairro que ainda não existe: vai para a fila do administrador. */
  bairro_novo?: string;
  link_pedido_url?: string | null;
  link_pedido_rotulo?: string | null;
}> {
  const nome = d.nome.trim();
  const descricao = d.descricao.trim();

  if (!nome) return falha("Digite o nome do seu negócio.");
  if (nome.length < 2) return falha("O nome precisa ter pelo menos 2 letras.");
  if (nome.length > 60) return falha(`O nome pode ter no máximo 60 caracteres (agora tem ${nome.length}).`);
  if (descricao.length > 300) {
    return falha(`A descrição pode ter no máximo 300 caracteres (agora tem ${descricao.length}).`);
  }
  if (!somenteDigitos(d.whatsapp)) return falha("Digite o WhatsApp com DDD, por exemplo (11) 99999-0000.");
  const whatsapp = normalizarWhatsApp(d.whatsapp);
  if (!whatsapp) return falha("WhatsApp inválido. Digite o DDD e o número, por exemplo (11) 99999-0000.");
  if (!MODOS.includes(d.modo)) return falha("Escolha como vocês atendem: entrega, retirada ou os dois.");
  const querSugerir = d.bairroId === BAIRRO_OUTRO || (!d.bairroId && Boolean(d.bairroNovo?.trim()));
  let bairroNovo: string | null = null;
  if (querSugerir) {
    const b = validarBairro(d.bairroNovo ?? "");
    if (!b.ok) return falha(b.erro);
    bairroNovo = b.valor;
  } else if (!d.bairroId) {
    return falha("Escolha o bairro.");
  }
  if (d.categoriaIds.length === 0) return falha("Marque pelo menos um ramo.");

  let link: { link_pedido_url: string | null; link_pedido_rotulo: string | null } | null = null;
  if (d.linkPedido !== undefined) {
    const url = validarLinkPedido(d.linkPedido);
    if (!url.ok) return falha(url.erro);
    const rotulo = validarRotuloLink(d.linkRotulo ?? "");
    if (!rotulo.ok) return falha(rotulo.erro);
    // o texto do botão só vale quando há link
    link = { link_pedido_url: url.valor, link_pedido_rotulo: url.valor ? rotulo.valor : null };
  }

  return certo({
    nome,
    descricao: descricao || null,
    whatsapp,
    modo_atendimento: d.modo,
    ...(bairroNovo ? { bairro_novo: bairroNovo } : { bairro_id: d.bairroId }),
    ...(link ?? {}),
  });
}

// ---------------------------------------------------------------------------
// Link de pedidos próprio (site, cardápio online, outro canal)
// ---------------------------------------------------------------------------

/** Texto padrão do botão quando o vendedor não escolhe um. */
export const ROTULO_PADRAO_LINK_PEDIDO = "Fazer pedido no site";

const SUFIXOS_INTERNOS = [".local", ".localhost", ".internal", ".lan", ".home", ".corp", ".intranet", ".test", ".invalid", ".example"];

/**
 * Endereço do site de pedidos. Vazio é válido (sem link). Aceita "meusite.com.br/cardapio" (assume https) e devolve o
 * endereço completo e normalizado. Recusa tudo que não seja um site público: outro tipo de link (javascript:, data:, ftp:),
 * usuário e senha no endereço, endereço numérico (IP), nomes internos (localhost, .local), porta e espaços.
 */
export function validarLinkPedido(entrada: string): Resultado<string | null> {
  let texto = entrada.trim();
  if (!texto) return certo(null);
  if (texto.length > 300) return falha(`O endereço do link pode ter no máximo 300 caracteres (agora tem ${texto.length}).`);
  if (/\s/.test(texto)) return falha("O endereço do link não pode ter espaços.");
  if (!/^[a-z][a-z0-9+.-]*:/i.test(texto)) texto = `https://${texto}`;

  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return falha("Endereço do link inválido. Exemplo: https://meusite.com.br/cardapio");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return falha("O endereço do link precisa começar com https:// (outros tipos de link não são aceitos).");
  }
  if (url.username || url.password) return falha("O endereço do link não pode ter usuário e senha.");
  if (url.port) return falha("Use o endereço do site sem número de porta.");

  const host = url.hostname.toLowerCase();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) {
    return falha("Use o nome do site (meusite.com.br), não um número de IP.");
  }
  if (!host.includes(".") || SUFIXOS_INTERNOS.some((s) => host.endsWith(s)) || !/\.([a-z]{2,}|xn--[a-z0-9-]+)$/.test(host)) {
    return falha("Use o endereço público do seu site, por exemplo https://meusite.com.br");
  }

  const final = url.href;
  if (final.length > 300) return falha("O endereço do link ficou longo demais. Use um endereço mais curto.");
  return certo(final);
}

/** Texto do botão do link de pedidos: até 30 caracteres, sem endereço dentro. Vazio usa o texto padrão. */
export function validarRotuloLink(entrada: string): Resultado<string | null> {
  const texto = entrada.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  if (!texto) return certo(null);
  if (texto.length > 30) return falha(`O texto do botão pode ter no máximo 30 caracteres (agora tem ${texto.length}).`);
  if (/https?:|www\.|\.com|\.br\b/i.test(texto)) return falha("Escreva só o texto do botão (por exemplo, “Pedir no nosso site”), sem o endereço.");
  return certo(texto);
}

// ---------------------------------------------------------------------------
// Horários
// ---------------------------------------------------------------------------

/** Máximo de períodos por dia (ex.: manhã e tarde/noite). Tem o mesmo limite no banco. */
export const MAX_PERIODOS = 2;

/**
 * Máscara de hora em 24 horas, para campo de texto com teclado numérico:
 * "1830" -> "18:30"; "8" -> "08"; "183" -> "18:3". Evita o relógio com AM/PM do celular.
 */
export function mascararHora(valor: string): string {
  let d = somenteDigitos(valor).slice(0, 4);
  if (d.length === 0) return "";
  if (Number(d[0]) > 2) d = `0${d}`.slice(0, 4); // "8" -> "08"
  if (d.length >= 2 && Number(d.slice(0, 2)) > 23) d = `23${d.slice(2)}`;
  if (d.length >= 3 && Number(d[2]) > 5) d = `${d.slice(0, 2)}0${d.slice(2)}`.slice(0, 4); // "18:7" -> "18:07"
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
}

/** Ao sair do campo: "18" vira "18:00" e "18:3" vira "18:30". */
export function completarHora(valor: string): string {
  const d = somenteDigitos(valor);
  if (!d) return "";
  if (d.length <= 2) return `${d.padStart(2, "0")}:00`;
  if (d.length === 3) return `${d.slice(0, 2)}:${d[2]}0`;
  return `${d.slice(0, 2)}:${d.slice(2, 4)}`;
}

/**
 * "8:00", "800" e "0800" viram "08:00"; "18" vira "18:00" e "18:3" vira "18:30" (o campo do painel faz o mesmo ao sair,
 * mas o servidor não depende disso). Qualquer outra coisa volta como veio e a validação recusa.
 */
export function normalizarHora(valor: string): string {
  const v = valor.trim();
  const completa = /^(\d{1,2}):(\d{2})$/.exec(v) ?? /^(\d{1,2})(\d{2})$/.exec(v);
  if (completa) return `${completa[1].padStart(2, "0")}:${completa[2]}`;
  const soHora = /^(\d{1,2})$/.exec(v);
  if (soHora) return `${soHora[1].padStart(2, "0")}:00`;
  const meiaMinuto = /^(\d{1,2}):(\d)$/.exec(v);
  if (meiaMinuto) return `${meiaMinuto[1].padStart(2, "0")}:${meiaMinuto[2]}0`;
  return v;
}

const minutosDe = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));

type Periodo = { abre: string; fecha: string };

/**
 * Horário da semana. Cada dia aceita até MAX_PERIODOS períodos (ex.: 08:00–12:00 e 18:00–22:00).
 * Aceita também um único período por dia (objeto) por compatibilidade.
 */
export function validarHorarios(
  dias: (Periodo | Periodo[])[],
): Resultado<{ dia_semana: number; abre: string; fecha: string }[]> {
  const linhas: { dia_semana: number; abre: string; fecha: string }[] = [];

  for (let dia = 0; dia < 7; dia++) {
    const brutos = dias[dia] === undefined ? [] : Array.isArray(dias[dia]) ? (dias[dia] as Periodo[]) : [dias[dia] as Periodo];
    const preenchidos = brutos
      .map((p, i) => ({ i, abre: normalizarHora(p?.abre ?? ""), fecha: normalizarHora(p?.fecha ?? "") }))
      .filter((p) => p.abre || p.fecha);
    if (preenchidos.length > MAX_PERIODOS) return falha(`Em ${NOMES_DIAS[dia]}, use no máximo ${MAX_PERIODOS} períodos.`);

    const varios = preenchidos.length > 1;
    const ok: { abre: string; fecha: string }[] = [];
    for (const [pos, p] of preenchidos.entries()) {
      const nome = varios ? `${NOMES_DIAS[dia]} (${pos + 1}º período)` : NOMES_DIAS[dia];
      if (!p.abre) return falha(`Em ${nome}, falta a hora de abrir.`);
      if (!p.fecha) return falha(`Em ${nome}, falta a hora de fechar.`);
      if (!HORA.test(p.abre) || !HORA.test(p.fecha)) return falha(`Em ${nome}, use horas no formato 18:30.`);
      if (p.abre === p.fecha) return falha(`Em ${nome}, abrir e fechar não podem ser no mesmo horário.`);
      ok.push({ abre: p.abre, fecha: p.fecha });
    }

    // os períodos do mesmo dia não podem se sobrepor (o que vira a noite conta até o dia seguinte)
    const ordenados = [...ok].sort((a, b) => minutosDe(a.abre) - minutosDe(b.abre));
    for (let k = 1; k < ordenados.length; k++) {
      const anterior = ordenados[k - 1];
      const fim = minutosDe(anterior.fecha) <= minutosDe(anterior.abre) ? minutosDe(anterior.fecha) + 1440 : minutosDe(anterior.fecha);
      if (minutosDe(ordenados[k].abre) < fim) {
        return falha(`Em ${NOMES_DIAS[dia]}, os dois períodos se sobrepõem. O 2º precisa começar depois que o 1º terminar.`);
      }
    }

    for (const p of ok) linhas.push({ dia_semana: dia, abre: p.abre, fecha: p.fecha });
  }
  return certo(linhas);
}

export function validarExcecao(
  d: { data: string; fechado: boolean; abre: string; fecha: string; motivo: string },
  hoje: string,
): Resultado<{ data: string; fechado: boolean; abre: string | null; fecha: string | null; motivo: string | null }> {
  const motivo = d.motivo.trim();
  if (!d.data) return falha("Escolha a data.");
  if (!dataExiste(d.data)) return falha("Data inválida. Escolha no calendário.");
  if (d.data < hoje) return falha("A data não pode ser no passado.");
  if (d.data > somarDias(hoje, 365)) return falha("Escolha uma data dentro do próximo ano.");
  if (motivo.length > 100) return falha(`O motivo pode ter no máximo 100 caracteres (agora tem ${motivo.length}).`);
  const abre = normalizarHora(d.abre);
  const fecha = normalizarHora(d.fecha);
  if (!d.fechado) {
    if (!abre || !fecha) return falha("Informe a hora de abrir e a de fechar, ou marque “Fechado o dia todo”.");
    if (!HORA.test(abre) || !HORA.test(fecha)) return falha("Use horas no formato 18:30.");
    if (abre === fecha) return falha("Abrir e fechar não podem ser no mesmo horário.");
  }
  return certo({
    data: d.data,
    fechado: d.fechado,
    abre: d.fechado ? null : abre,
    fecha: d.fechado ? null : fecha,
    motivo: motivo || null,
  });
}

export function validarStatus(
  d: { status: string; ate: string; msg: string },
  hoje: string,
): Resultado<{ status_manual: string; status_manual_ate: string | null; status_manual_msg: string | null }> {
  const msg = d.msg.trim();
  if (!["normal", "fechado_hoje", "ferias"].includes(d.status)) return falha("Escolha uma das opções.");
  if (msg.length > 140) return falha(`A mensagem pode ter no máximo 140 caracteres (agora tem ${msg.length}).`);

  let ate: string | null = null;
  if (d.status === "fechado_hoje") ate = hoje;
  if (d.status === "ferias" && d.ate) {
    if (!dataExiste(d.ate)) return falha("Data de volta inválida. Escolha no calendário.");
    if (d.ate < hoje) return falha("A data de volta não pode ser no passado.");
    if (d.ate > somarDias(hoje, 365)) return falha("Escolha uma data de volta dentro do próximo ano.");
    ate = d.ate;
  }
  return certo({
    status_manual: d.status,
    status_manual_ate: ate,
    status_manual_msg: d.status === "normal" ? null : msg || null,
  });
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

export function validarItem(d: {
  nome: string;
  descricao: string;
  preco: string;
}): Resultado<{ nome: string; descricao: string | null; preco: number | null }> {
  const nome = d.nome.trim();
  const descricao = d.descricao.trim();
  if (!nome) return falha("Digite o nome do item.");
  if (nome.length > 80) return falha(`O nome do item pode ter no máximo 80 caracteres (agora tem ${nome.length}).`);
  if (descricao.length > 200) {
    return falha(`A descrição pode ter no máximo 200 caracteres (agora tem ${descricao.length}).`);
  }
  const preco = lerPreco(d.preco);
  if (preco === "invalido") return falha("Preço inválido. Use números, por exemplo 25,90 (máximo 99.999).");
  return certo({ nome, descricao: descricao || null, preco });
}

/** Nome de uma categoria do menu ("Bebidas", "Cachorro quente"). O banco confere de novo e calcula a chave de comparação. */
export function validarCategoriaProduto(nome: string): Resultado<string> {
  const limpo = nome.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  if (!limpo) return falha("Digite o nome da categoria, por exemplo Bebidas.");
  if (limpo.length < 2) return falha("O nome da categoria precisa ter pelo menos 2 letras.");
  if (limpo.length > 30) return falha(`O nome da categoria pode ter no máximo 30 caracteres (agora tem ${limpo.length}).`);
  if (!/[\p{L}\p{N}]/u.test(limpo)) return falha("Use letras no nome da categoria.");
  if (/(https?:|www\.|@)/i.test(limpo)) return falha("Use só o nome da categoria, sem site nem e-mail.");
  return certo(limpo);
}

// ---------------------------------------------------------------------------
// "Monte o seu" (pizza, açaí, marmita...): produto, tamanhos e adicionais
// ---------------------------------------------------------------------------

function validarNomeCurto(bruto: string, o: { rotulo: string; min: number; max: number }): Resultado<string> {
  const nome = limparTexto(bruto);
  if (!nome) return falha(`Digite ${o.rotulo}.`);
  if (nome.length < o.min) return falha(`${o.rotulo[0].toUpperCase()}${o.rotulo.slice(1)} precisa ter pelo menos ${o.min} letras.`);
  if (nome.length > o.max) return falha(`${o.rotulo[0].toUpperCase()}${o.rotulo.slice(1)} pode ter no máximo ${o.max} caracteres (agora tem ${nome.length}).`);
  if (!/[\p{L}\p{N}]/u.test(nome)) return falha(`Use letras em ${o.rotulo}.`);
  if (/(https?:|www\.|@)/i.test(nome)) return falha(`Use só texto em ${o.rotulo}, sem site nem e-mail.`);
  return certo(nome);
}

export interface DadosDoMontavel {
  nome: string;
  rotulo_escolhas: string;
}

/** Criar o produto: nome ("Pizza") e como chamar as escolhas incluídas ("Sabores"). */
export function validarMontavelNovo(d: { nome: string; rotuloEscolhas: string }): Resultado<DadosDoMontavel> {
  const nome = validarNomeCurto(d.nome, { rotulo: "o nome do produto (por exemplo Pizza ou Açaí)", min: 2, max: 40 });
  if (!nome.ok) return nome;
  const rotulo = validarNomeCurto(d.rotuloEscolhas || "Sabores", { rotulo: "o nome das escolhas (por exemplo Sabores)", min: 2, max: 30 });
  if (!rotulo.ok) return rotulo;
  return certo({ nome: nome.valor, rotulo_escolhas: rotulo.valor });
}

export interface AjustesDoMontavel extends DadosDoMontavel {
  descricao: string | null;
  rotulo_adicionais: string;
  max_adicionais: number;
  escolha_obrigatoria: boolean;
}

export function validarAjustesDoMontavel(d: {
  nome: string;
  descricao: string;
  rotuloEscolhas: string;
  rotuloAdicionais: string;
  maxAdicionais: string;
  escolhaObrigatoria: boolean;
}): Resultado<AjustesDoMontavel> {
  const base = validarMontavelNovo(d);
  if (!base.ok) return base;
  const adicionais = validarNomeCurto(d.rotuloAdicionais || "Adicionais", { rotulo: "o nome dos adicionais (por exemplo Adicionais)", min: 2, max: 30 });
  if (!adicionais.ok) return adicionais;
  const descricao = limparTexto(d.descricao);
  if (descricao.length > 200) return falha(`A descrição pode ter no máximo 200 caracteres (agora tem ${descricao.length}).`);
  if (/(https?:|www\.|@)/i.test(descricao)) return falha("Use só texto na descrição, sem site nem e-mail.");
  const max = Number(d.maxAdicionais.trim() === "" ? 5 : d.maxAdicionais);
  if (!Number.isInteger(max) || max < 0 || max > 20) return falha("O máximo de adicionais por pedido vai de 0 a 20.");
  return certo({
    ...base.valor,
    descricao: descricao || null,
    rotulo_adicionais: adicionais.valor,
    max_adicionais: max,
    escolha_obrigatoria: d.escolhaObrigatoria,
  });
}

export function validarTamanho(d: { nome: string; preco: string; maxEscolhas: string }): Resultado<{ nome: string; preco: number; max_escolhas: number }> {
  const nome = validarNomeCurto(d.nome, { rotulo: "o nome do tamanho (por exemplo Média (30 cm))", min: 1, max: 40 });
  if (!nome.ok) return nome;
  const preco = lerPreco(d.preco);
  if (preco === null || preco === "invalido" || preco <= 0 || preco > 2000) {
    return falha("Digite o preço do tamanho, maior que zero, por exemplo 54,00 (máximo 2.000).");
  }
  const max = Number(d.maxEscolhas.trim() === "" ? 1 : d.maxEscolhas);
  if (!Number.isInteger(max) || max < 0 || max > 10) return falha("Quantas escolhas o tamanho inclui? Use um número de 0 a 10 (0 = nenhuma).");
  return certo({ nome: nome.valor, preco, max_escolhas: max });
}

export function validarAdicional(d: { nome: string; preco: string }): Resultado<{ nome: string; preco: number }> {
  const nome = validarNomeCurto(d.nome, { rotulo: "o nome do adicional (por exemplo Bacon)", min: 1, max: 40 });
  if (!nome.ok) return nome;
  const preco = d.preco.trim() === "" ? 0 : lerPreco(d.preco);
  if (preco === null || preco === "invalido" || preco > 500) return falha("Preço inválido. Use números, por exemplo 3,00 (máximo 500), ou deixe vazio para sem custo.");
  return certo({ nome: nome.valor, preco });
}

// ---------------------------------------------------------------------------
// Pagamento do plano destaque (registrado pelo admin)
// ---------------------------------------------------------------------------

export function validarPagamento(d: {
  dias: string;
  valor: string;
  forma: string;
  obs: string;
}): Resultado<{ dias: number; valor: number; forma: string; observacao: string | null }> {
  if (!["pix", "dinheiro", "cortesia"].includes(d.forma)) {
    return falha("Escolha a forma de pagamento: Pix, dinheiro ou cortesia.");
  }
  const dias = Number(d.dias);
  if (!d.dias.trim() || !Number.isInteger(dias) || dias < 1 || dias > 365) {
    return falha("Informe quantos dias de destaque, de 1 a 365.");
  }
  const obs = d.obs.trim();
  if (obs.length > 200) return falha(`A observação pode ter no máximo 200 caracteres (agora tem ${obs.length}).`);

  if (d.forma === "cortesia") return certo({ dias, valor: 0, forma: d.forma, observacao: obs || null });

  const valor = lerPreco(d.valor);
  if (valor === null || valor === "invalido" || valor <= 0) {
    return falha("Informe o valor recebido, maior que zero, por exemplo 30,00. Para não cobrar, escolha Cortesia.");
  }
  return certo({ dias, valor, forma: d.forma, observacao: obs || null });
}

// ---------------------------------------------------------------------------
// Fale conosco (problemas, sugestões e dúvidas)
// ---------------------------------------------------------------------------

export const TIPOS_FEEDBACK = [
  ["problema", "Algo não funciona"],
  ["sugestao", "Tenho uma sugestão"],
  ["duvida", "Tenho uma dúvida"],
] as const;

export type TipoFeedback = (typeof TIPOS_FEEDBACK)[number][0];

export function validarFeedback(d: {
  tipo: string;
  mensagem: string;
  pagina: string;
  contato: string;
}): Resultado<{ tipo: TipoFeedback; mensagem: string; pagina: string | null; contato: string | null }> {
  const tipo = TIPOS_FEEDBACK.find(([id]) => id === d.tipo)?.[0];
  if (!tipo) return falha("Escolha o tipo da mensagem: problema, sugestão ou dúvida.");

  const mensagem = d.mensagem.trim();
  if (mensagem.length < 10) {
    return falha(`Conte um pouco mais: a mensagem precisa ter pelo menos 10 caracteres (agora tem ${mensagem.length}).`);
  }
  if (mensagem.length > 1000) {
    return falha(`A mensagem pode ter no máximo 1000 caracteres (agora tem ${mensagem.length}).`);
  }

  const pagina = d.pagina.trim();
  if (pagina.length > 200) return falha("O endereço da página é longo demais (máximo 200 caracteres).");

  const contato = d.contato.trim();
  if (contato.length > 100) return falha(`O contato pode ter no máximo 100 caracteres (agora tem ${contato.length}).`);

  return certo({ tipo, mensagem, pagina: pagina || null, contato: contato || null });
}

// ---------------------------------------------------------------------------
// Novo aceite dos Termos
// ---------------------------------------------------------------------------

/** Texto de erro quando a caixa do aceite não foi marcada; nulo quando está tudo certo. */
export function validarAceiteTermos(marcado: boolean): string | null {
  return marcado ? null : "Para continuar, marque que você leu e aceita os Termos de Uso e a Política de Privacidade.";
}

// ---------------------------------------------------------------------------
// Avaliação por convite
// ---------------------------------------------------------------------------

/** E-mail do cliente para o convite: minúsculo, sem espaços nas pontas, com o formato conferido. */
export function validarEmailConvite(email: string): Resultado<string> {
  const e = email.trim().toLowerCase();
  if (!e) return falha("Digite o e-mail do cliente.");
  if (e.length > 254 || !EMAIL.test(e)) return falha("E-mail inválido. Use o formato nome@email.com.");
  return certo(e);
}

/** "maria@gmail.com" -> "m***@gmail.com": o que o vendedor vê de quem foi convidado. */
export function mascararEmail(email: string): string {
  const [usuario = "", dominio = ""] = email.trim().toLowerCase().split("@");
  return `${usuario.slice(0, 1)}***@${dominio}`;
}

/** Nota e comentário digitados pelo cliente (o banco confere de novo). */
export function validarAvaliacao(d: { nota: number; comentario: string }): Resultado<{ nota: number; comentario: string | null }> {
  if (!Number.isInteger(d.nota) || d.nota < 1 || d.nota > 5) return falha("Escolha uma nota de 1 a 5 estrelas.");
  const comentario = d.comentario.trim();
  if (comentario.length > 500) return falha(`O comentário pode ter no máximo 500 caracteres (agora tem ${comentario.length}).`);
  return certo({ nota: d.nota, comentario: comentario || null });
}

export interface Configuracoes {
  avaliacoes_exigem_aprovacao: boolean;
  vendedores_exigem_aprovacao: boolean;
}

/** Os dois interruptores do admin chegam como "exigir" ou "liberar"; qualquer outra coisa é recusada. */
export function validarConfiguracoes(d: { avaliacoes: string; vendedores: string }): Resultado<Configuracoes> {
  const ler = (v: string) => (v === "exigir" ? true : v === "liberar" ? false : null);
  const avaliacoes = ler(d.avaliacoes);
  const vendedores = ler(d.vendedores);
  if (avaliacoes === null || vendedores === null) return falha("Escolha uma opção para avaliações e para vendedores.");
  return certo({ avaliacoes_exigem_aprovacao: avaliacoes, vendedores_exigem_aprovacao: vendedores });
}

export const NOME_AVALIADOR_MAX = 40;

/** Nome de quem avalia: opcional, público, sem endereço de site, e-mail nem telefone (o banco confere de novo). */
export function validarNomeDoAvaliador(nome: string): Resultado<string | null> {
  const limpo = nome.replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
  if (!limpo) return certo(null);
  if (limpo.length > NOME_AVALIADOR_MAX) {
    return falha(`O nome pode ter no máximo ${NOME_AVALIADOR_MAX} caracteres (agora tem ${limpo.length}).`);
  }
  if (/(https?:|www\.|@|[0-9]{5,})/i.test(limpo)) {
    return falha("Use só o seu nome (ou apelido). Não coloque site, e-mail nem telefone.");
  }
  return certo(limpo);
}

/** Resposta de `avaliar_por_convite` -> texto para o cliente. */
export const MENSAGENS_AVALIACAO: Record<string, string> = {
  convite_invalido: "Não encontramos esse convite. Confira se abriu o link inteiro do e-mail.",
  convite_usado: "Esse convite já foi usado. Cada link vale uma avaliação.",
  convite_expirado: "Esse convite venceu (vale 30 dias). Peça um novo à loja.",
  comentario_longo: "O comentário pode ter no máximo 500 caracteres.",
  nome_longo: "O nome pode ter no máximo 40 caracteres.",
  pedido_invalido: "Não encontramos esse pedido. Confira se abriu o link inteiro.",
  pedido_nao_concluido: "Você poderá avaliar quando a loja concluir o pedido.",
  pedido_ja_avaliado: "Esse pedido já foi avaliado. Cada pedido vale uma avaliação.",
  nome_invalido: "Use só o seu nome (ou apelido). Não coloque site, e-mail nem telefone.",
  nota_invalida: "Escolha uma nota de 1 a 5 estrelas.",
  muitas_tentativas: "Muitas tentativas com link errado. Aguarde 1 hora e tente de novo.",
};

// ---------------------------------------------------------------------------
// Compartilhar o perfil
// ---------------------------------------------------------------------------

/** Mensagem que acompanha o link ao divulgar o perfil: curta, sem quebras estranhas e sem caracteres de controle. */
export function validarMensagemCompartilhar(texto: string): Resultado<string> {
  const limpo = texto.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
  if (limpo.length < 5) return falha("Escreva uma mensagem curta para acompanhar o link (pelo menos 5 caracteres).");
  if (limpo.length > 200) return falha(`A mensagem pode ter no máximo 200 caracteres (agora tem ${limpo.length}).`);
  return certo(limpo);
}

// ---------------------------------------------------------------------------
// Resumo do Fale conosco (leitura do que o banco devolve)
// ---------------------------------------------------------------------------

/**
 * Conta as mensagens por situação a partir das linhas `{ status }` que o banco devolve. Situação desconhecida,
 * linha estranha ou resposta que não é lista são ignoradas, para a tela nunca quebrar nem mostrar "NaN".
 */
export function lerContagemFeedback(linhas: unknown): ContagemFeedback {
  const c: ContagemFeedback = { novo: 0, aceito: 0, recusado: 0, resolvido: 0 };
  if (!Array.isArray(linhas)) return c;
  for (const l of linhas) {
    const status = l && typeof l === "object" ? (l as { status?: unknown }).status : null;
    if (status === "novo" || status === "aceito" || status === "recusado" || status === "resolvido") c[status] += 1;
  }
  return c;
}

// ---------------------------------------------------------------------------
// Resumo por cidade (leitura do que o banco devolve)
// ---------------------------------------------------------------------------

const naoNegativo = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

/**
 * Lê a resposta de `admin_resumo_cidades` com segurança: contagens chegam como texto (bigint), linhas sem
 * identificação são descartadas e número inválido vira 0, para a tela nunca quebrar nem mostrar "NaN".
 */
export function lerResumoCidades(bruto: unknown): ResumoCidade[] {
  if (!Array.isArray(bruto)) return [];
  const linhas: ResumoCidade[] = [];
  for (const r of bruto) {
    if (!r || typeof r !== "object") continue;
    const l = r as Record<string, unknown>;
    if (typeof l.cidade_id !== "string" || typeof l.nome !== "string" || typeof l.slug !== "string") continue;
    linhas.push({
      cidade_id: l.cidade_id,
      nome: l.nome,
      uf: typeof l.uf === "string" ? l.uf : null,
      slug: l.slug,
      ativa: l.ativa !== false,
      criada_em: typeof l.criada_em === "string" ? l.criada_em : "",
      vendedores_ativos: naoNegativo(l.vendedores_ativos),
      vendedores_pendentes: naoNegativo(l.vendedores_pendentes),
      vendedores_suspensos: naoNegativo(l.vendedores_suspensos),
      perfis_completos: naoNegativo(l.perfis_completos),
      destaques_ativos: naoNegativo(l.destaques_ativos),
      visitas_perfis_30d: naoNegativo(l.visitas_perfis_30d),
      toques_whatsapp_30d: naoNegativo(l.toques_whatsapp_30d),
      avaliacoes_publicadas: naoNegativo(l.avaliacoes_publicadas),
    });
  }
  return linhas;
}

// ---------------------------------------------------------------------------
// Cidades e bairros (administração)
// ---------------------------------------------------------------------------

/** "São José dos Pinhais" -> "sao-jose-dos-pinhais" */
export function gerarSlug(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function validarCidade(d: {
  nome: string;
  uf: string;
  slug?: string;
}): Resultado<{ nome: string; uf: string | null; slug: string }> {
  const nome = d.nome.trim().replace(/\s+/g, " ");
  const uf = d.uf.trim().toUpperCase();
  if (!nome) return falha("Digite o nome da cidade.");
  if (nome.length < 2) return falha("O nome da cidade precisa ter pelo menos 2 letras.");
  if (nome.length > 60) return falha(`O nome da cidade pode ter no máximo 60 caracteres (agora tem ${nome.length}).`);
  if (uf && !/^[A-Z]{2}$/.test(uf)) return falha("O estado (UF) tem 2 letras, por exemplo MG. Deixe em branco se não souber.");

  const slug = (d.slug ?? "").trim() ? (d.slug as string).trim().toLowerCase() : gerarSlug(nome);
  if (!slug || !SLUG.test(slug) || slug.length > 60) {
    return falha("O endereço da cidade (slug) só pode ter letras minúsculas, números e hífen, por exemplo santa-maria.");
  }
  return certo({ nome, uf: uf || null, slug });
}

export function validarBairro(nome: string): Resultado<string> {
  const limpo = nome.trim().replace(/\s+/g, " ");
  if (!limpo) return falha("Digite o nome do bairro.");
  if (limpo.length < 2) return falha("O nome do bairro precisa ter pelo menos 2 letras.");
  if (limpo.length > 60) return falha(`O nome do bairro pode ter no máximo 60 caracteres (agora tem ${limpo.length}).`);
  return certo(limpo);
}

// ---------------------------------------------------------------------------
// Pedidos pelo site (versão 2.x)
// ---------------------------------------------------------------------------

export interface DadosDoPedido {
  modo: string;
  nome: string;
  telefone: string;
  endereco: string;
  pagamento: string;
  /** Valor digitado em "troco para quanto" (só vale para dinheiro). */
  troco: string;
  observacoes: string;
}

export interface RegrasDaLojaParaPedido {
  modoAtendimento: "entrega" | "retirada" | "ambos";
  pagamentosAceitos: readonly string[];
  /** Total que o site mostra (o banco recalcula). */
  total: number;
}

export interface PedidoValidado {
  p_modo: "entrega" | "retirada";
  p_nome: string;
  p_telefone: string;
  p_endereco: string | null;
  p_pagamento: string;
  p_troco: number | null;
  p_observacoes: string | null;
}

const limparTexto = (t: string) => t.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();

/** Confere os dados do pedido antes de enviar. O banco confere tudo de novo (esta é só a mensagem amigável). */
export function validarPedido(d: DadosDoPedido, loja: RegrasDaLojaParaPedido): Resultado<PedidoValidado> {
  if (d.modo !== "entrega" && d.modo !== "retirada") return falha("Escolha entrega ou retirada.");
  if (loja.modoAtendimento !== "ambos" && loja.modoAtendimento !== d.modo) {
    return falha(`Esta loja só atende por ${loja.modoAtendimento === "entrega" ? "entrega" : "retirada"}.`);
  }

  const nome = limparTexto(d.nome);
  if (nome.length < 2) return falha("Digite o seu nome (pelo menos 2 letras).");
  if (nome.length > 60) return falha(`O nome pode ter no máximo 60 caracteres (agora tem ${nome.length}).`);

  if (!somenteDigitos(d.telefone)) return falha("Digite o telefone com DDD, por exemplo (11) 99999-0000.");
  const telefone = normalizarWhatsApp(d.telefone);
  if (!telefone) return falha("Telefone inválido. Digite o DDD e o número, por exemplo (11) 99999-0000.");

  const endereco = limparTexto(d.endereco);
  if (d.modo === "entrega") {
    if (endereco.length < 5) return falha("Digite o endereço completo para a entrega (rua, número e bairro).");
    if (endereco.length > 200) return falha(`O endereço pode ter no máximo 200 caracteres (agora tem ${endereco.length}).`);
  }

  if (!loja.pagamentosAceitos.includes(d.pagamento)) return falha("Escolha como vai pagar.");

  let troco: number | null = null;
  if (d.pagamento === "dinheiro" && d.troco.trim()) {
    const valor = lerPreco(d.troco);
    if (valor === "invalido" || valor === null || valor <= 0) return falha("Digite o valor do troco, por exemplo 50 ou 50,00.");
    if (valor < loja.total) {
      return falha(
        `O troco precisa ser para um valor igual ou maior que o total (${loja.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}).`,
      );
    }
    if (valor > 10000) return falha("O valor do troco é alto demais. Confira o número.");
    troco = valor;
  }

  const observacoes = limparTexto(d.observacoes);
  if (observacoes.length > 300) {
    return falha(`As observações podem ter no máximo 300 caracteres (agora têm ${observacoes.length}).`);
  }

  return certo({
    p_modo: d.modo,
    p_nome: nome,
    p_telefone: telefone,
    p_endereco: d.modo === "entrega" ? endereco : null,
    p_pagamento: d.pagamento,
    p_troco: troco,
    p_observacoes: observacoes || null,
  });
}

/** Configuração de pedidos da loja (aba Pedidos do painel). */
export function validarConfigPedidos(d: {
  aceita: boolean;
  pagamentos: string[];
  taxa: string;
}): Resultado<{ aceita_pedidos: boolean; pagamentos_aceitos: string[]; taxa_entrega: number }> {
  const permitidos = ["pix", "dinheiro", "cartao"];
  const pagamentos = permitidos.filter((p) => d.pagamentos.includes(p));
  if (pagamentos.length === 0) return falha("Marque pelo menos um meio de pagamento que você aceita.");

  const bruta = d.taxa.trim();
  let taxa = 0;
  if (bruta) {
    const valor = lerPreco(bruta);
    if (valor === "invalido" || valor === null || valor > 999) {
      return falha("Taxa de entrega inválida. Use um valor como 5 ou 5,50 (até R$ 999). Deixe em branco se não cobra.");
    }
    taxa = valor;
  }
  return certo({ aceita_pedidos: d.aceita, pagamentos_aceitos: pagamentos, taxa_entrega: taxa });
}
