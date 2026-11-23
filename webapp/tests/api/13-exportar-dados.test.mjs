// "Baixar meus dados" (LGPD): a função devolve só o que é do usuário logado e nada que identifique terceiros.

import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { admin, anonimo, Contexto, sufixo } from "../helpers.mjs";

const ctx = new Contexto();
const MARCA = `Exporta-${sufixo()}`;
let ana;
let beto;
let semPerfil;
let dados;

const exportar = async (cliente) => {
  const { data, error } = await cliente.rpc("exportar_meus_dados");
  assert.ifError(error);
  return data;
};

before(async () => {
  ana = await ctx.novoVendedor({ aprovado: true });
  beto = await ctx.novoVendedor({ aprovado: true });
  semPerfil = await ctx.novoVendedor({ semPerfil: true });

  const { data: ramo } = await admin.from("categorias").select("id, nome").limit(1).single();
  await admin.from("vendedor_categorias").insert({ vendedor_id: ana.vendedorId, categoria_id: ramo.id });
  await admin.from("itens_cardapio").insert({ vendedor_id: ana.vendedorId, nome: `${MARCA} prato da Ana`, preco: 21.5 });
  await admin.from("itens_cardapio").insert({ vendedor_id: beto.vendedorId, nome: `${MARCA} prato do Beto`, preco: 9 });
  await admin.from("horarios_funcionamento").insert({ vendedor_id: ana.vendedorId, dia_semana: 2, abre: "08:00", fecha: "12:00" });
  await admin.from("excecoes_horario").insert({ vendedor_id: ana.vendedorId, data: "2031-12-25", fechado: true, motivo: "Natal" });
  await admin.from("avaliacoes").insert({ vendedor_id: ana.vendedorId, nota: 5, comentario: `${MARCA} muito bom`, codigo_verificacao: `EX${sufixo()}`, aprovada: true });
  await admin.from("avaliacoes").insert({ vendedor_id: beto.vendedorId, nota: 1, comentario: `${MARCA} do Beto`, codigo_verificacao: `EY${sufixo()}`, aprovada: true });
  const { error: erroConvite } = await admin.rpc("criar_convite_avaliacao", { p_vendedor: ana.vendedorId, p_email: `cliente.${sufixo()}@exemplo.com` });
  assert.ifError(erroConvite);
  await admin.from("denuncias").insert({ vendedor_id: ana.vendedorId, motivo: "golpe", descricao: `${MARCA} denúncia secreta`, contato: "denunciante@exemplo.com", ip_hash: "hashsecreto" });
  await admin.from("pagamentos").insert({ vendedor_id: ana.vendedorId, valor: 30, forma: "pix", dias: 30, destaque_de: new Date().toISOString(), destaque_ate: new Date(Date.now() + 30 * 86_400_000).toISOString() });
  await admin.from("eventos").insert({ tipo: "visita_vendedor", vendedor_id: ana.vendedorId, ip_hash: "hashsecreto" });
  await admin.from("eventos").insert({ tipo: "whatsapp", vendedor_id: ana.vendedorId, ip_hash: "hashsecreto" });

  dados = await exportar(ana.client);
});
after(async () => {
  await admin.from("denuncias").delete().like("descricao", `${MARCA}%`);
  await ctx.limpar();
});

describe("o que entra no arquivo", () => {
  test("conta e perfil são os da própria pessoa", () => {
    assert.equal(dados.conta.email, ana.email);
    assert.equal(dados.conta.usuario, ana.username);
    assert.ok(dados.conta.criada_em);
    assert.equal(dados.perfil.id, ana.vendedorId);
    assert.ok(dados.perfil.bairro, "traz o nome do bairro, não só o código");
    assert.ok(dados.perfil.cidade, "traz o nome da cidade, não só o código");
  });

  test("menu, horários, datas especiais e ramos", () => {
    assert.deepEqual(dados.menu.map((i) => i.nome), [`${MARCA} prato da Ana`]);
    assert.equal(Number(dados.menu[0].preco), 21.5);
    assert.equal(dados.horarios.length, 1);
    assert.equal(dados.horarios[0].dia_semana, 2);
    assert.deepEqual(dados.datas_especiais.map((d) => d.motivo), ["Natal"]);
    assert.equal(dados.ramos.length, 1);
    assert.equal(typeof dados.ramos[0], "string");
  });

  test("avaliações recebidas (nota e comentário), convites de avaliação e pagamentos do destaque", () => {
    assert.deepEqual(dados.avaliacoes_recebidas.map((a) => [a.nota, a.comentario]), [[5, `${MARCA} muito bom`]]);
    assert.equal(dados.convites_de_avaliacao.length, 1);
    assert.deepEqual(Object.keys(dados.convites_de_avaliacao[0]).sort(), ["criado_em", "email_mascarado", "situacao"]);
    assert.match(dados.convites_de_avaliacao[0].email_mascarado, /^c\*\*\*@exemplo\.com$/);
    assert.equal(dados.convites_de_avaliacao[0].situacao, "pendente");
    assert.equal(dados.pagamentos_do_destaque.length, 1);
    assert.equal(Number(dados.pagamentos_do_destaque[0].valor), 30);
  });

  test("uso do perfil: só contagens", () => {
    assert.equal(Number(dados.uso_do_perfil.visitas_ao_perfil), 1);
    assert.equal(Number(dados.uso_do_perfil.toques_no_whatsapp), 1);
  });

  test("tem a data de geração e o aviso do que fica de fora", () => {
    assert.ok(Date.parse(dados.gerado_em) > Date.now() - 60_000);
    assert.match(dados.sobre_este_arquivo, /LGPD/);
  });

  test("o histórico de alterações lista data, entidade e ação, sem o conteúdo", async () => {
    await ana.client.from("vendedores").update({ descricao: `${MARCA} mudou` }).eq("id", ana.vendedorId);
    const novo = await exportar(ana.client);
    assert.ok(novo.historico_de_alteracoes.length > 0);
    for (const h of novo.historico_de_alteracoes) assert.deepEqual(Object.keys(h).sort(), ["acao", "data", "o_que"]);
  });
});

describe("o que NÃO pode entrar", () => {
  test("nada de denúncias, código secreto das avaliações, IP ou dono", () => {
    const txt = JSON.stringify(dados);
    for (const proibido of ["denunciante@exemplo.com", `${MARCA} denúncia secreta`, "hashsecreto", "codigo_verificacao", "ip_hash", "owner_id", "denuncias", "token", "email_hash"]) {
      assert.ok(!txt.includes(proibido), `vazou: ${proibido}`);
    }
  });

  test("nenhum dado do outro vendedor", () => {
    const txt = JSON.stringify(dados);
    assert.ok(!txt.includes(`${MARCA} prato do Beto`));
    assert.ok(!txt.includes(`${MARCA} do Beto`));
    assert.ok(!txt.includes(beto.email));
    assert.ok(!txt.includes(beto.vendedorId));
  });

  test("o arquivo do outro vendedor também é só dele", async () => {
    const dele = await exportar(beto.client);
    const txt = JSON.stringify(dele);
    assert.equal(dele.conta.email, beto.email);
    assert.ok(txt.includes(`${MARCA} prato do Beto`));
    assert.ok(!txt.includes(`${MARCA} prato da Ana`));
    assert.ok(!txt.includes(ana.email));
  });
});

describe("quem pode chamar", () => {
  test("visitante sem login não consegue", async () => {
    const { data, error } = await anonimo().rpc("exportar_meus_dados");
    assert.ok(error || !data, "anônimo não pode exportar");
  });

  test("quem ainda não criou o perfil recebe só a conta (perfil nulo, listas vazias)", async () => {
    const d = await exportar(semPerfil.client);
    assert.equal(d.conta.email, semPerfil.email);
    assert.equal(d.perfil, null);
    for (const lista of ["menu", "horarios", "datas_especiais", "avaliacoes_recebidas", "pagamentos_do_destaque", "convites_de_avaliacao"]) {
      assert.deepEqual(d[lista], [], lista);
    }
  });

  test("um administrador também recebe só os próprios dados, não os de todos", async () => {
    const adm = await ctx.novoVendedor({ aprovado: true, ehAdmin: true });
    const d = await exportar(adm.client);
    const txt = JSON.stringify(d);
    assert.equal(d.conta.email, adm.email);
    assert.ok(!txt.includes(ana.email));
    assert.ok(!txt.includes(`${MARCA} prato da Ana`));
  });
});
