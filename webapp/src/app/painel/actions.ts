"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { agoraBR } from "@/lib/horarios";
import { camposDoModo } from "@/lib/itens";
import { createAdminClient } from "@/lib/supabase/admin";
import { excluirContaCompleta } from "@/lib/conta";
import { enviarEmail, montarConviteDeAvaliacao } from "@/lib/email";
import { TERMOS_VERSAO } from "@/lib/legal";
import {
  validarAceiteTermos,
  validarAdicional,
  validarAjustesDoMontavel,
  validarCategoriaProduto,
  validarMontavelNovo,
  validarTamanho,
  validarConfigPedidos,
  validarExcecao,
  validarHorarios,
  MAX_PERIODOS,
  validarEmailConvite,
  validarItem,
  validarPerfil,
  validarStatus,
} from "@/lib/validacao";

type Estado = { erro?: string; ok?: string };


const erro = (mensagem: string): Estado => ({ erro: mensagem });
const texto = (form: FormData, campo: string) => String(form.get(campo) ?? "").trim();

function revalidar() {
  revalidatePath("/painel");
  revalidatePath("/");
  revalidatePath("/vendedores/[id]", "page");
}

async function contexto() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: vendedor } = await supabase
    .from("vendedores")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  return { supabase, user, vendedorId: (vendedor?.id as string | undefined) ?? null };
}

// ---------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------

const ERROS_SUGESTAO: Record<string, string> = {
  nome_invalido: "Esse nome de bairro não vale. Use só o nome do bairro, sem site, e-mail nem telefone.",
  limite_diario: "Você já sugeriu 5 bairros hoje. Escolha um da lista ou tente de novo amanhã.",
  cidade_invalida: "Escolha a cidade de novo e tente salvar.",
};

export async function salvarPerfil(_: Estado, form: FormData): Promise<Estado> {
  const { supabase, user, vendedorId } = await contexto();

  const categoriaIds = form.getAll("categoria_ids").map(String).filter(Boolean);
  const v = validarPerfil({
    nome: texto(form, "nome"),
    descricao: texto(form, "descricao"),
    whatsapp: texto(form, "whatsapp"),
    modo: texto(form, "modo_atendimento"),
    bairroId: texto(form, "bairro_id"),
    bairroNovo: texto(form, "bairro_novo"),
    categoriaIds,
    linkPedido: texto(form, "link_pedido"),
    linkRotulo: texto(form, "link_rotulo"),
  });
  if (!v.ok) return erro(v.erro);
  const { bairro_novo: bairroNovo, ...dados } = v.valor;

  let id = vendedorId;
  let jaNoAr = false;
  if (id) {
    const { error } = await supabase.from("vendedores").update(dados).eq("id", id).eq("owner_id", user.id);
    if (error) return erro("Não foi possível salvar agora. Tente novamente.");
  } else {
    const { data, error } = await supabase
      .from("vendedores")
      .insert({ ...dados, owner_id: user.id })
      .select("id, ativo")
      .single();
    if (error) return erro("Não foi possível cadastrar agora. Tente novamente.");
    id = data.id as string;
    jaNoAr = Boolean(data.ativo);
  }

  await supabase.from("vendedor_categorias").delete().eq("vendedor_id", id);
  const { error: erroRamos } = await supabase
    .from("vendedor_categorias")
    .insert(categoriaIds.map((categoria_id) => ({ vendedor_id: id, categoria_id })));
  if (erroRamos) return erro("Salvamos o perfil, mas não os ramos. Tente salvar de novo.");

  let aviso = "";
  if (bairroNovo) {
    // o bairro não está na lista: vai para a fila da equipe (ou, se já existir com outra grafia, é usado direto)
    const { data, error } = await supabase.rpc("sugerir_bairro", { p_nome: bairroNovo, p_cidade: texto(form, "cidade_id") });
    if (error) {
      const chave = Object.keys(ERROS_SUGESTAO).find((k) => error.message.includes(k));
      return erro(`Salvamos o perfil, mas não o bairro. ${chave ? ERROS_SUGESTAO[chave] : "Tente de novo."}`);
    }
    const r = data as { resultado: string; bairro: string };
    aviso =
      r.resultado === "ja_existia"
        ? ` O bairro "${r.bairro}" já existia e foi escolhido para você.`
        : ` Seu bairro "${r.bairro}" vai para a conferência da equipe; até lá aparece como "a confirmar".`;
  }

  revalidar();
  return {
    ok:
      (vendedorId
        ? "Perfil salvo!"
        : jaNoAr
          ? "Cadastro feito! Seu negócio já aparece no catálogo."
          : "Cadastro enviado! Seu negócio aparece no catálogo assim que nossa equipe aprovar.") + aviso,
  };
}

// ---------------------------------------------------------------------------
// Horários, exceções por data e aviso (férias / não abre hoje)
// ---------------------------------------------------------------------------

export async function salvarHorarios(_: Estado, form: FormData): Promise<Estado> {
  const { supabase, vendedorId } = await contexto();
  if (!vendedorId) return erro("Cadastre o perfil primeiro.");

  const v = validarHorarios(
    Array.from({ length: 7 }, (_, dia) =>
      Array.from({ length: MAX_PERIODOS }, (_, i) => ({ abre: texto(form, `abre_${dia}_${i}`), fecha: texto(form, `fecha_${dia}_${i}`) })),
    ),
  );
  if (!v.ok) return erro(v.erro);
  const linhas = v.valor.map((l) => ({ ...l, vendedor_id: vendedorId }));

  const { error: erroDelete } = await supabase.from("horarios_funcionamento").delete().eq("vendedor_id", vendedorId);
  if (erroDelete) return erro("Não foi possível salvar agora. Tente novamente.");

  if (linhas.length > 0) {
    const { error } = await supabase.from("horarios_funcionamento").insert(linhas);
    if (error) return erro("Não foi possível salvar agora. Tente novamente.");
  }

  await supabase.rpc("registrar_historico", {
    p_vendedor: vendedorId,
    p_acao: "atualizar_horarios",
    p_dados: { dias_abertos: new Set(linhas.map((l) => l.dia_semana)).size, periodos: linhas.length },
  });
  revalidar();
  return { ok: "Horários salvos!" };
}

export async function salvarExcecao(_: Estado, form: FormData): Promise<Estado> {
  const { supabase, vendedorId } = await contexto();
  if (!vendedorId) return erro("Cadastre o perfil primeiro.");

  const v = validarExcecao(
    {
      data: texto(form, "data"),
      fechado: form.get("fechado") === "on",
      abre: texto(form, "abre"),
      fecha: texto(form, "fecha"),
      motivo: texto(form, "motivo"),
    },
    agoraBR().data,
  );
  if (!v.ok) return erro(v.erro);

  const { error } = await supabase.from("excecoes_horario").upsert(
    { vendedor_id: vendedorId, ...v.valor },
    { onConflict: "vendedor_id,data" },
  );
  if (error) return erro("Não foi possível salvar agora. Tente novamente.");

  revalidar();
  return { ok: "Data especial salva!" };
}

export async function removerExcecao(form: FormData) {
  const { supabase } = await contexto();
  await supabase.from("excecoes_horario").delete().eq("id", texto(form, "id"));
  revalidar();
}

export async function definirStatus(_: Estado, form: FormData): Promise<Estado> {
  const { supabase, vendedorId } = await contexto();
  if (!vendedorId) return erro("Cadastre o perfil primeiro.");

  const v = validarStatus(
    { status: texto(form, "status"), ate: texto(form, "ate"), msg: texto(form, "msg") },
    agoraBR().data,
  );
  if (!v.ok) return erro(v.erro);
  const status = v.valor.status_manual;

  const { error } = await supabase
    .from("vendedores")
    .update(v.valor)
    .eq("id", vendedorId);
  if (error) return erro("Não foi possível salvar agora. Tente novamente.");

  revalidar();
  return {
    ok:
      status === "normal"
        ? "Tudo certo: seu perfil voltou a seguir o horário normal."
        : status === "ferias"
          ? "Aviso de férias publicado."
          : "Aviso publicado: hoje você não abre.",
  };
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

export async function adicionarItem(_: Estado, form: FormData): Promise<Estado> {
  const { supabase, vendedorId } = await contexto();
  if (!vendedorId) return erro("Cadastre o perfil primeiro.");

  const v = validarItem({
    nome: texto(form, "nome"),
    descricao: texto(form, "descricao"),
    preco: texto(form, "preco"),
  });
  if (!v.ok) return erro(v.erro);

  const { count } = await supabase
    .from("itens_cardapio")
    .select("id", { count: "exact", head: true })
    .eq("vendedor_id", vendedorId);
  if ((count ?? 0) >= 100) return erro("Limite de 100 itens no menu.");

  // categoria é opcional; o banco só aceita uma categoria desta mesma loja
  const categoria = texto(form, "categoria_id");
  const { error } = await supabase.from("itens_cardapio").insert({
    vendedor_id: vendedorId,
    ...v.valor,
    categoria_produto_id: UUID.test(categoria) ? categoria : null,
    ordem: (count ?? 0) + 1,
  });
  if (error) return erro("Não foi possível adicionar agora. Tente novamente.");

  revalidar();
  return { ok: `“${v.valor.nome}” adicionado!` };
}

// ---------------------------------------------------------------------------
// Categorias do menu (opcionais): o vendedor cria as dele e escolhe a de cada item
// ---------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mensagemDeCategoria(e: { code?: string; message: string }) {
  if (e.code === "23505") return "Você já tem uma categoria com esse nome (ou parecido, como Bebida e Bebidas).";
  if (e.message.includes("limite_categorias")) return "Você já tem 15 categorias, que é o máximo.";
  if (e.message.includes("nome_invalido")) return "Esse nome de categoria não vale. Use só o nome, sem site nem e-mail.";
  return "Não foi possível salvar agora. Tente novamente.";
}

export async function adicionarCategoria(_: Estado, form: FormData): Promise<Estado> {
  const { supabase, vendedorId } = await contexto();
  if (!vendedorId) return erro("Cadastre o perfil primeiro.");

  const v = validarCategoriaProduto(texto(form, "nome"));
  if (!v.ok) return erro(v.erro);

  const { error } = await supabase.from("categorias_produto").insert({ vendedor_id: vendedorId, nome: v.valor });
  if (error) return erro(mensagemDeCategoria(error));

  revalidar();
  return { ok: `Categoria “${v.valor}” criada. Agora escolha a categoria dos seus itens.` };
}

export async function renomearCategoria(_: Estado, form: FormData): Promise<Estado> {
  const { supabase } = await contexto();
  const v = validarCategoriaProduto(texto(form, "nome"));
  if (!v.ok) return erro(v.erro);

  const { error } = await supabase.from("categorias_produto").update({ nome: v.valor }).eq("id", texto(form, "id"));
  if (error) return erro(mensagemDeCategoria(error));

  revalidar();
  return { ok: "Categoria renomeada." };
}

// Apagar a categoria não apaga os itens: eles só ficam sem categoria.
export async function removerCategoria(form: FormData) {
  const { supabase } = await contexto();
  await supabase.from("categorias_produto").delete().eq("id", texto(form, "id"));
  revalidar();
}

// Sobe ou desce uma categoria trocando a posição com a vizinha.
export async function moverCategoria(form: FormData) {
  const { supabase, vendedorId } = await contexto();
  if (!vendedorId) return;

  const { data } = await supabase.from("categorias_produto").select("id, ordem").eq("vendedor_id", vendedorId).order("ordem");
  const lista = data ?? [];
  const i = lista.findIndex((c) => c.id === texto(form, "id"));
  const j = texto(form, "direcao") === "subir" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= lista.length) return;

  await Promise.all([
    supabase.from("categorias_produto").update({ ordem: lista[j].ordem }).eq("id", lista[i].id),
    supabase.from("categorias_produto").update({ ordem: lista[i].ordem }).eq("id", lista[j].id),
  ]);
  revalidar();
}

export async function definirCategoriaDoItem(form: FormData) {
  const { supabase } = await contexto();
  const categoria = texto(form, "categoria_id");
  await supabase
    .from("itens_cardapio")
    .update({ categoria_produto_id: UUID.test(categoria) ? categoria : null })
    .eq("id", texto(form, "id"));
  revalidar();
}

// ---------------------------------------------------------------------------
// "Monte o seu" (pizza, açaí...): produto com tamanhos de preço fixo, escolhas incluídas e adicionais pagos
// ---------------------------------------------------------------------------

function mensagemDeMontavel(e: { code?: string; message: string }) {
  if (e.message.includes("limite_montaveis")) return "Você já tem 5 produtos do tipo “monte o seu”, que é o máximo.";
  if (e.message.includes("limite_tamanhos")) return "Cada produto pode ter até 6 tamanhos.";
  if (e.message.includes("limite_adicionais")) return "Cada produto pode ter até 30 adicionais.";
  if (e.message.includes("nome_invalido")) return "Use só texto nos nomes, sem site nem e-mail.";
  if (e.message.includes("categoria_invalida")) return "Essa categoria não é da sua loja.";
  return "Não foi possível salvar agora. Tente novamente.";
}

export async function criarMontavel(_: Estado, form: FormData): Promise<Estado> {
  const { supabase, vendedorId } = await contexto();
  if (!vendedorId) return erro("Cadastre o perfil primeiro.");

  const v = validarMontavelNovo({ nome: texto(form, "nome"), rotuloEscolhas: texto(form, "rotulo_escolhas") });
  if (!v.ok) return erro(v.erro);

  const { error } = await supabase.from("montaveis").insert({ vendedor_id: vendedorId, ...v.valor });
  if (error) return erro(mensagemDeMontavel(error));

  revalidar();
  return { ok: `“${v.valor.nome}” criado. Agora adicione os tamanhos com o preço de cada um.` };
}

export async function salvarMontavel(_: Estado, form: FormData): Promise<Estado> {
  const { supabase } = await contexto();
  const v = validarAjustesDoMontavel({
    nome: texto(form, "nome"),
    descricao: texto(form, "descricao"),
    rotuloEscolhas: texto(form, "rotulo_escolhas"),
    rotuloAdicionais: texto(form, "rotulo_adicionais"),
    maxAdicionais: texto(form, "max_adicionais"),
    escolhaObrigatoria: form.get("escolha_obrigatoria") === "on",
  });
  if (!v.ok) return erro(v.erro);

  const { error } = await supabase.from("montaveis").update(v.valor).eq("id", texto(form, "id"));
  if (error) return erro(mensagemDeMontavel(error));

  revalidar();
  return { ok: "Ajustes salvos." };
}

// Pausar tira o produto do perfil sem apagar nada; reativar traz de volta.
export async function alternarMontavel(form: FormData) {
  const { supabase } = await contexto();
  await supabase.from("montaveis").update({ disponivel: texto(form, "disponivel") === "true" }).eq("id", texto(form, "id"));
  revalidar();
}

export async function removerMontavel(form: FormData) {
  const { supabase } = await contexto();
  await supabase.from("montaveis").delete().eq("id", texto(form, "id"));
  revalidar();
}

export async function adicionarTamanho(_: Estado, form: FormData): Promise<Estado> {
  const { supabase } = await contexto();
  const v = validarTamanho({ nome: texto(form, "nome"), preco: texto(form, "preco"), maxEscolhas: texto(form, "max_escolhas") });
  if (!v.ok) return erro(v.erro);

  const { error } = await supabase.from("montavel_tamanhos").insert({ montavel_id: texto(form, "montavel_id"), ...v.valor });
  if (error) return erro(mensagemDeMontavel(error));

  revalidar();
  return { ok: `Tamanho “${v.valor.nome}” adicionado.` };
}

export async function salvarTamanho(_: Estado, form: FormData): Promise<Estado> {
  const { supabase } = await contexto();
  const v = validarTamanho({ nome: texto(form, "nome"), preco: texto(form, "preco"), maxEscolhas: texto(form, "max_escolhas") });
  if (!v.ok) return erro(v.erro);

  const { error } = await supabase.from("montavel_tamanhos").update(v.valor).eq("id", texto(form, "id"));
  if (error) return erro(mensagemDeMontavel(error));

  revalidar();
  return { ok: "Tamanho salvo." };
}

export async function removerTamanho(form: FormData) {
  const { supabase } = await contexto();
  await supabase.from("montavel_tamanhos").delete().eq("id", texto(form, "id"));
  revalidar();
}

// De quais categorias do menu vêm as escolhas incluídas (os sabores são os itens normais dessas categorias).
export async function salvarCategoriasDoMontavel(_: Estado, form: FormData): Promise<Estado> {
  const { supabase } = await contexto();
  const montavelId = texto(form, "montavel_id");
  const ids = [...new Set(form.getAll("categoria_ids").map(String).filter((c) => UUID.test(c)))];

  const { error: erroApagar } = await supabase.from("montavel_categorias").delete().eq("montavel_id", montavelId);
  if (erroApagar) return erro(mensagemDeMontavel(erroApagar));
  if (ids.length > 0) {
    const { error } = await supabase
      .from("montavel_categorias")
      .insert(ids.map((categoria_produto_id) => ({ montavel_id: montavelId, categoria_produto_id })));
    if (error) return erro(mensagemDeMontavel(error));
  }

  revalidar();
  return { ok: ids.length > 0 ? "Pronto. Os itens dessas categorias viram opções para o cliente escolher." : "Nenhuma categoria marcada." };
}

export async function adicionarAdicional(_: Estado, form: FormData): Promise<Estado> {
  const { supabase } = await contexto();
  const v = validarAdicional({ nome: texto(form, "nome"), preco: texto(form, "preco") });
  if (!v.ok) return erro(v.erro);

  const { error } = await supabase.from("montavel_adicionais").insert({ montavel_id: texto(form, "montavel_id"), ...v.valor });
  if (error) return erro(mensagemDeMontavel(error));

  revalidar();
  return { ok: `“${v.valor.nome}” adicionado.` };
}

// "Acabou o bacon": tira o adicional da lista do cliente sem apagar; reativar traz de volta.
export async function alternarAdicional(form: FormData) {
  const { supabase } = await contexto();
  await supabase.from("montavel_adicionais").update({ disponivel: texto(form, "disponivel") === "true" }).eq("id", texto(form, "id"));
  revalidar();
}

export async function removerAdicional(form: FormData) {
  const { supabase } = await contexto();
  await supabase.from("montavel_adicionais").delete().eq("id", texto(form, "id"));
  revalidar();
}

export async function alternarDisponivel(form: FormData) {
  const { supabase } = await contexto();
  // modo: "disponivel", "hoje" (volta amanhã) ou "sem_previsao" (até o vendedor reativar)
  // (formulário antigo mandava só "disponivel": true/false)
  const modo = texto(form, "modo") || (texto(form, "disponivel") === "true" ? "disponivel" : "sem_previsao");
  const campos = camposDoModo(modo, agoraBR().data);
  if (!campos) return;
  await supabase.from("itens_cardapio").update(campos).eq("id", texto(form, "id"));
  revalidar();
}

// "Destaque da casa": o vendedor escolhe até 3 itens (o banco recusa o 4º). Os selos "Mais pedido" vêm só dos dados.
export async function alternarDestaque(form: FormData) {
  const { supabase } = await contexto();
  await supabase
    .from("itens_cardapio")
    .update({ destaque: texto(form, "destaque") === "true" })
    .eq("id", texto(form, "id"));
  revalidar();
}

// ---------------------------------------------------------------------------
// Pedidos pelo site (versão 2.x)
// ---------------------------------------------------------------------------

export async function salvarConfigPedidos(_: Estado, form: FormData): Promise<Estado> {
  const { supabase, vendedorId } = await contexto();
  if (!vendedorId) return erro("Cadastre o perfil primeiro.");

  const v = validarConfigPedidos({
    aceita: form.get("aceita_pedidos") === "on",
    pagamentos: form.getAll("pagamentos").map(String),
    taxa: texto(form, "taxa_entrega"),
  });
  if (!v.ok) return erro(v.erro);

  const { error } = await supabase.from("vendedores").update(v.valor).eq("id", vendedorId);
  if (error) return erro("Não foi possível salvar agora. Tente novamente.");

  revalidar();
  return {
    ok: v.valor.aceita_pedidos
      ? "Salvo! Os pedidos pelo site entram quando a sua loja estiver aberta."
      : "Salvo! Os pedidos pelo site estão desligados; o seu perfil continua com o botão do WhatsApp.",
  };
}

export async function mudarStatusPedido(form: FormData) {
  const { supabase } = await contexto();
  await supabase.rpc("mudar_status_pedido", {
    p_pedido: texto(form, "id"),
    p_status: texto(form, "status"),
    p_motivo: texto(form, "motivo") || null,
  });
  revalidatePath("/painel");
}

export async function recusarEBloquear(form: FormData) {
  const { supabase } = await contexto();
  await supabase.rpc("recusar_e_bloquear_pedido", { p_pedido: texto(form, "id"), p_motivo: "Pedido recusado" });
  revalidatePath("/painel");
}

export async function desbloquearCliente(form: FormData) {
  const { supabase, vendedorId } = await contexto();
  if (!vendedorId) return;
  await supabase.from("clientes_bloqueados").delete().eq("vendedor_id", vendedorId).eq("telefone_hash", texto(form, "hash"));
  revalidatePath("/painel");
}

export async function removerItem(form: FormData) {
  const { supabase } = await contexto();
  await supabase.from("itens_cardapio").delete().eq("id", texto(form, "id"));
  revalidar();
}

// ---------------------------------------------------------------------------
// Códigos de avaliação (verificação de compra)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Convite de avaliação: o link vai direto para o e-mail do cliente; o vendedor nunca o vê
// ---------------------------------------------------------------------------

const ERROS_CONVITE: Record<string, string> = {
  email_invalido: "E-mail inválido. Use o formato nome@email.com.",
  email_proprio: "Você não pode convidar o seu próprio e-mail. O convite é para o cliente.",
  convite_recente: "Esse e-mail já recebeu um convite seu nos últimos 30 dias.",
  limite_diario: "Você já enviou 20 convites nas últimas 24 horas. Tente de novo amanhã.",
  limite_pendentes: "Você tem 50 convites sem resposta. Cancele alguns ou espere responderem.",
};

async function enderecoDoSite() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  return `${host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https"}://${host}`;
}

export async function convidarParaAvaliar(_: Estado, form: FormData): Promise<Estado> {
  const { supabase, vendedorId } = await contexto();
  if (!vendedorId) return erro("Cadastre o perfil primeiro.");

  const v = validarEmailConvite(texto(form, "email"));
  if (!v.ok) return erro(v.erro);
  const email = v.valor;

  const { data: loja } = await supabase.from("vendedores").select("nome").eq("id", vendedorId).single();
  const nomeDaLoja = (loja?.nome as string | undefined) ?? "loja";

  // O vendedor já foi conferido acima (sessão + dono do perfil). O token só existe no servidor.
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("criar_convite_avaliacao", { p_vendedor: vendedorId, p_email: email });
  if (error || !data) {
    const chave = Object.keys(ERROS_CONVITE).find((k) => error?.message.includes(k));
    return erro(chave ? ERROS_CONVITE[chave] : "Não foi possível criar o convite agora. Tente novamente.");
  }
  const convite = data as { id: string; token: string; mascarado: string };

  const link = `${await enderecoDoSite()}/avaliar/${convite.token}`;
  const mensagem = montarConviteDeAvaliacao(nomeDaLoja, link);
  const envio = await enviarEmail({ para: email, assunto: mensagem.assunto, texto: mensagem.texto, html: mensagem.html });
  if (!envio.ok) {
    await admin.from("convites_avaliacao").delete().eq("id", convite.id); // sem e-mail enviado, o convite não existe
    return erro(
      envio.erro === "nao_configurado"
        ? "O envio de e-mail do site ainda não está configurado. Fale com a equipe pelo Ajuda."
        : "Não conseguimos enviar o e-mail agora. Confira o endereço e tente de novo.",
    );
  }

  revalidar();
  return { ok: `Convite enviado para ${convite.mascarado}. Só o cliente recebe o link; você não o vê.` };
}

// Novo aceite dos Termos e da Política quando a versão muda (grava a data e a versão no perfil de quem está logado)
export async function aceitarTermos(_: Estado, form: FormData): Promise<Estado> {
  const invalido = validarAceiteTermos(form.get("aceite_termos") === "on");
  if (invalido) return erro(invalido);

  const { supabase } = await contexto();
  const { error } = await supabase.rpc("aceitar_termos", { p_versao: TERMOS_VERSAO });
  if (error) return erro("Não foi possível registrar o aceite agora. Tente novamente.");
  revalidatePath("/painel");
  return { ok: "Obrigado! Aceite registrado." };
}

export async function cancelarConvite(form: FormData) {
  const { supabase } = await contexto();
  await supabase.rpc("cancelar_convite", { p_id: texto(form, "id") });
  revalidar();
}

// Direito de exclusão (LGPD): apaga perfil, menu, arquivos e o login. Pede o usuário como confirmação.
export async function excluirConta(_: Estado, form: FormData): Promise<Estado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase.from("perfis_vendedor").select("username").eq("user_id", user.id).maybeSingle();
  const esperado = perfil?.username ?? user.email ?? "";
  if (texto(form, "confirmacao").toLowerCase() !== esperado.toLowerCase()) {
    return erro(`Para excluir, digite exatamente o seu usuário: ${esperado}`);
  }

  const resultado = await excluirContaCompleta(createAdminClient(), user.id);
  if (resultado.erro) return erro("Não foi possível excluir a conta agora. Tente novamente ou fale com a equipe.");

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/?conta=excluida");
}

export async function sair() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
