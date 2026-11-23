// Cria (ou recria) o cliente de teste principal: Pizzaria Exemplo (fictícia, pizza delivery),
// com conta de vendedor, perfil aprovado, horários, menu e (opcional) um PDF de cardápio.
//
// Pode rodar quantas vezes quiser: não duplica nada. Só funciona no Supabase LOCAL.
//
//   npm run seed:cliente-teste -- "caminho/do/cardapio.pdf"
//
// Variáveis opcionais:
//   TESTE_WHATSAPP   WhatsApp do cliente, só dígitos com 55 (padrão: número fictício)
//   TESTE_SENHA      senha da conta de teste (sem ela, uma senha aleatória é gerada e impressa no fim)
//   TESTE_PDF        caminho do PDF (alternativa ao argumento)
//
// Conta criada:  e-mail teste.pizzaria@exemplo.com  ·  usuário pizzaria.exemplo

import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { admin, cfg } from "../tests/helpers.mjs"; // também recusa rodar fora do ambiente local

const CLIENTE = {
  email: "teste.pizzaria@exemplo.com",
  username: "pizzaria.exemplo",
  senha: process.env.TESTE_SENHA ?? `local-${randomBytes(9).toString("base64url")}`,
  nome: "Pizzaria Exemplo",
  descricao:
    "Pizzas salgadas e doces no sistema delivery. Média (30 cm) por R$ 50 e grande (35 cm) por R$ 60. Pagamento por Pix, cartão ou dinheiro.",
  whatsapp: process.env.TESTE_WHATSAPP ?? "5555999990000",
  modo: "entrega",
  bairro: "Centro",
  ramos: ["pizzaria"], // slugs em `categorias`
  // terça (2) a domingo (0), 18h às 23h; segunda (1) fechado
  horarios: [0, 2, 3, 4, 5, 6].map((dia) => ({ dia_semana: dia, abre: "18:00", fecha: "23:00" })),
};

// Itens que descrevem tamanhos e preços (o cardápio tem preço por tamanho, não por sabor)
const TAMANHOS = [
  ["Pizza média (30 cm)", "Até 2 sabores.", 50],
  ["Pizza grande (35 cm)", "Até 3 sabores.", 60],
  ["Adicional: borda recheada", "Acrescenta R$ 8,00 ao valor da pizza.", 8],
];

const SALGADAS = [
  ["Calabresa", "molho, mussarela, calabresa, cebola, orégano"],
  ["Frango com catupiry", "molho, frango desfiado, catupiry, orégano"],
  ["Marguerita", "molho, mussarela, tomate, manjericão"],
  ["Mussarela", "molho, mussarela, tomate, orégano"],
  ["Portuguesa", "molho, presunto, ovo, cebola, pimentão, mussarela"],
  ["Quatro queijos", "molho, mussarela, provolone, parmesão, catupiry"],
  ["Bacon", "molho, mussarela, bacon, orégano"],
  ["Vegetariana", "molho, mussarela, brócolis, milho, palmito, tomate"],
];

const DOCES = [
  ["Chocolate", "chocolate ao leite e granulado"],
  ["Banana com canela", "banana, açúcar, canela e mussarela"],
  ["Romeu e Julieta", "goiabada e queijo"],
];

const itens = [
  ...TAMANHOS.map(([nome, descricao, preco]) => ({ nome, descricao, preco })),
  ...SALGADAS.map(([nome, descricao]) => ({ nome: `${nome} (salgada)`, descricao, preco: null })),
  ...DOCES.map(([nome, descricao]) => ({ nome: `${nome} (doce)`, descricao, preco: null })),
].map((item, i) => ({ ...item, ordem: i + 1, disponivel: true }));

function falhar(mensagem) {
  console.error(`\nERRO: ${mensagem}`);
  process.exit(1);
}
const ok = (r, contexto) => {
  if (r.error) falhar(`${contexto}: ${r.error.message}`);
  return r.data;
};

// ---------------------------------------------------------------------------

const caminhoPdf = process.argv[2] ?? process.env.TESTE_PDF;

// 1. Conta de vendedor (cria ou reaproveita)
const { data: lista } = await admin.auth.admin.listUsers({ perPage: 1000 });
let usuario = lista.users.find((u) => u.email === CLIENTE.email);
if (!usuario) {
  const { data, error } = await admin.auth.admin.createUser({
    email: CLIENTE.email,
    password: CLIENTE.senha,
    email_confirm: true,
    user_metadata: { username: CLIENTE.username, categoria_ids: [] },
  });
  if (error) falhar(`criar usuário: ${error.message}`);
  usuario = data.user;
  console.log("• conta criada");
} else {
  await admin.auth.admin.updateUserById(usuario.id, { password: CLIENTE.senha });
  console.log("• conta já existia (senha redefinida)");
}

// 2. Ramos e bairro
const categorias = ok(await admin.from("categorias").select("id, slug").in("slug", CLIENTE.ramos), "buscar ramos");
if (categorias.length !== CLIENTE.ramos.length) {
  falhar(`ramo(s) não encontrado(s) em categorias: ${CLIENTE.ramos.join(", ")}. Rode "npx supabase db reset" ou crie-os.`);
}
let { data: bairro } = await admin.from("bairros").select("id").eq("nome", CLIENTE.bairro).maybeSingle();
if (!bairro) bairro = ok(await admin.from("bairros").insert({ nome: CLIENTE.bairro }).select("id").single(), "criar bairro");

await admin
  .from("perfis_vendedor")
  .update({ categoria_ids: categorias.map((c) => c.id) })
  .eq("user_id", usuario.id);

// 3. Perfil do vendedor: aprovado e ativo (como se o admin já tivesse aprovado)
const perfil = {
  owner_id: usuario.id,
  nome: CLIENTE.nome,
  descricao: CLIENTE.descricao,
  whatsapp: CLIENTE.whatsapp,
  modo_atendimento: CLIENTE.modo,
  bairro_id: bairro.id,
  ativo: true,
  aprovado_em: new Date().toISOString(),
  status_manual: "normal",
  status_manual_ate: null,
  status_manual_msg: null,
};
const { data: existente } = await admin.from("vendedores").select("id").eq("owner_id", usuario.id).maybeSingle();
const vendedorId = existente
  ? (ok(await admin.from("vendedores").update(perfil).eq("id", existente.id).select("id").single(), "atualizar vendedor")).id
  : (ok(await admin.from("vendedores").insert(perfil).select("id").single(), "criar vendedor")).id;
console.log(`• perfil ${existente ? "atualizado" : "criado"}: ${CLIENTE.nome}`);

// 4. Ramos, horários e menu (substitui o que havia, sem duplicar)
ok(await admin.from("vendedor_categorias").delete().eq("vendedor_id", vendedorId), "limpar ramos");
ok(await admin.from("vendedor_categorias").insert(categorias.map((c) => ({ vendedor_id: vendedorId, categoria_id: c.id }))), "gravar ramos");

ok(await admin.from("horarios_funcionamento").delete().eq("vendedor_id", vendedorId), "limpar horários");
ok(await admin.from("horarios_funcionamento").insert(CLIENTE.horarios.map((h) => ({ ...h, vendedor_id: vendedorId }))), "gravar horários");

ok(await admin.from("itens_cardapio").delete().eq("vendedor_id", vendedorId), "limpar menu");
ok(await admin.from("itens_cardapio").insert(itens.map((i) => ({ ...i, vendedor_id: vendedorId }))), "gravar menu");
console.log(`• ${CLIENTE.horarios.length} dias de horário e ${itens.length} itens no menu`);

// 5. PDF do cardápio no Storage
if (caminhoPdf) {
  let arquivo;
  try {
    arquivo = await readFile(caminhoPdf);
  } catch {
    falhar(`não consegui ler o PDF em: ${caminhoPdf}`);
  }
  if (arquivo.length > 5 * 1024 * 1024) falhar("o PDF passa de 5 MB (limite do bucket).");

  const destino = `${usuario.id}/cardapio.pdf`;
  ok(
    await admin.storage.from("cardapios").upload(destino, arquivo, { contentType: "application/pdf", upsert: true }),
    "enviar PDF",
  );
  const { data: publico } = admin.storage.from("cardapios").getPublicUrl(destino);
  // a URL pública tem sempre o mesmo caminho; o parâmetro v= evita cache de versão antiga
  ok(
    await admin
      .from("vendedores")
      .update({ cardapio_url: `${publico.publicUrl}?v=${Date.now()}`, cardapio_tipo: "application/pdf" })
      .eq("id", vendedorId),
    "salvar link do PDF",
  );
  console.log(`• PDF do cardápio enviado (${(arquivo.length / 1024 / 1024).toFixed(1)} MB)`);
} else {
  console.log("• PDF não enviado (passe o caminho como argumento para incluir o cardápio em PDF)");
}

console.log("\nPronto.");
console.log(`  Perfil público:  http://localhost:3000/vendedores/${vendedorId}`);
console.log(`  Login:           usuário "${CLIENTE.username}" ou e-mail ${CLIENTE.email}`);
console.log(`  Senha:           ${CLIENTE.senha}${process.env.TESTE_SENHA ? " (de TESTE_SENHA)" : " (gerada agora; rode de novo para gerar outra)"}`);
console.log(`  API local:       ${cfg.url}`);
