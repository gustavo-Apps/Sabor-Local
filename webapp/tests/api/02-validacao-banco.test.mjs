// A última barreira: mesmo que alguém pule a tela e fale direto com a API, o
// banco recusa dados inválidos (violação de CHECK = código 23514).

import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { admin, Contexto } from "../helpers.mjs";

const ctx = new Contexto();
let ze;
before(async () => {
  ze = await ctx.novoVendedor({ aprovado: true });
});
after(() => ctx.limpar());

const recusa = (nome, fazer, codigo = "23514") =>
  test(nome, async () => {
    const { error } = await fazer();
    assert.ok(error, "deveria ser recusado");
    assert.ok([codigo].flat().includes(error.code), `${error.code}: ${error.message}`);
  });

const perfilBase = () => ({
  owner_id: null,
  nome: "Perfil de teste",
  whatsapp: "5511999990000",
  bairro_id: ze.bairroId,
});

describe("vendedor", () => {
  const editar = (campos) => () => ze.client.from("vendedores").update(campos).eq("id", ze.vendedorId);

  recusa("nome com 1 letra", editar({ nome: "Z" }));
  recusa("nome com 61 letras", editar({ nome: "a".repeat(61) }));
  recusa("descrição com 301 letras", editar({ descricao: "a".repeat(301) }));
  recusa("descrição de 1 MB (payload gigante)", editar({ descricao: "a".repeat(1_000_000) }));
  recusa("WhatsApp com letras", editar({ whatsapp: "5511abcdefgh" }));
  recusa("WhatsApp curto", editar({ whatsapp: "12345" }));
  recusa("WhatsApp com símbolos", editar({ whatsapp: "(11) 99999-0000" }));
  recusa("modo de atendimento inventado", editar({ modo_atendimento: "drone" }), "22P02");
  recusa("status manual inventado", editar({ status_manual: "greve" }));
  recusa("mensagem de status com 141 letras", editar({ status_manual_msg: "a".repeat(141) }));
  recusa("data de volta inválida", editar({ status_manual_ate: "2026-02-30" }), "22008");

  test("nome com emoji, acento e aspas é aceito (texto puro)", async () => {
    const { error } = await editar({ nome: `Zé's "Pizza" 🍕 <b>` })();
    assert.ifError(error);
  });

  recusa("segundo perfil para o mesmo dono usando bairro inexistente", () =>
    ze.client.from("vendedores").insert({ ...perfilBase(), owner_id: ze.id, bairro_id: "00000000-0000-0000-0000-000000000000" }),
    "23503",
  );
});

describe("itens do menu", () => {
  const item = (campos) => () => ze.client.from("itens_cardapio").insert({ vendedor_id: ze.vendedorId, nome: "Item", ...campos });

  recusa("nome vazio", item({ nome: "" }));
  recusa("nome com 81 letras", item({ nome: "a".repeat(81) }));
  recusa("descrição com 201 letras", item({ descricao: "a".repeat(201) }));
  recusa("preço negativo", item({ preco: -0.01 }));
  recusa("preço acima de 99999", item({ preco: 100000 }));
  recusa("preço com mais dígitos que o campo", item({ preco: 123456789012 }), "22003");
  recusa("preço em texto", item({ preco: "barato" }), "22P02");

  test("preço 0 e 99999 são aceitos (limites)", async () => {
    for (const preco of [0, 99999]) {
      const { error } = await item({ preco })();
      assert.ifError(error);
    }
  });
});

describe("horários e datas especiais", () => {
  const horario = (campos) => () =>
    ze.client.from("horarios_funcionamento").insert({ vendedor_id: ze.vendedorId, dia_semana: 1, abre: "08:00", fecha: "18:00", ...campos });
  const excecao = (campos) => () =>
    ze.client.from("excecoes_horario").insert({ vendedor_id: ze.vendedorId, data: "2031-05-05", fechado: true, ...campos });

  recusa("dia da semana 7", horario({ dia_semana: 7 }));
  recusa("dia da semana -1", horario({ dia_semana: -1 }));
  recusa("hora inexistente (25:00)", horario({ abre: "25:00" }), ["22007", "22008"]);
  recusa("hora em texto", horario({ abre: "cedo" }), ["22007", "22008"]);

  recusa("exceção aberta sem horário", excecao({ fechado: false }));
  recusa("exceção com data inválida", excecao({ data: "2031-02-31" }), "22008");
  recusa("exceção com motivo de 101 letras", excecao({ motivo: "a".repeat(101) }));

  test("até 2 períodos por dia: o terceiro é recusado pelo banco", async () => {
    const dia = (n) => horario({ dia_semana: 3, abre: n[0], fecha: n[1] })();
    assert.ifError((await dia(["08:00", "12:00"])).error);
    assert.ifError((await dia(["18:00", "22:00"])).error);
    const { error } = await dia(["13:00", "14:00"]);
    assert.match(error?.message ?? "", /maximo_dois_periodos/);
    // outro dia continua livre
    assert.ifError((await horario({ dia_semana: 4 })()).error);
  });

  test("mudar um período para um dia que já tem 2 também é recusado", async () => {
    const { data: um } = await ze.client.from("horarios_funcionamento").select("id").eq("vendedor_id", ze.vendedorId).eq("dia_semana", 4).limit(1).single();
    const { error } = await ze.client.from("horarios_funcionamento").update({ dia_semana: 3 }).eq("id", um.id);
    assert.match(error?.message ?? "", /maximo_dois_periodos/);
  });

  test("exceção duplicada na mesma data (23505)", async () => {
    await excecao({ data: "2031-06-06" })();
    const { error } = await excecao({ data: "2031-06-06" })();
    assert.equal(error?.code, "23505");
  });
});

describe("avaliações, denúncias e cadastro", () => {
  test("nota fora de 1 a 5 vira status 'nota_invalida' (sem derrubar nada)", async () => {
    const anon = (await import("../helpers.mjs")).anonimo();
    for (const nota of [0, 6, -1, 999]) {
      const { data } = await anon.rpc("enviar_avaliacao", { p_vendedor: ze.vendedorId, p_nota: nota, p_comentario: "", p_codigo: "ABC234" });
      assert.equal(data, "nota_invalida", `nota ${nota}`);
    }
  });

  test("comentário com 501 letras vira 'comentario_longo'", async () => {
    const anon = (await import("../helpers.mjs")).anonimo();
    const { data } = await anon.rpc("enviar_avaliacao", { p_vendedor: ze.vendedorId, p_nota: 5, p_comentario: "a".repeat(501), p_codigo: "ABC234" });
    assert.equal(data, "comentario_longo");
  });

  test("denúncia com motivo inventado é recusada (enum)", async () => {
    const anon = (await import("../helpers.mjs")).anonimo();
    const { error } = await anon.rpc("enviar_denuncia", {
      p_vendedor: ze.vendedorId, p_avaliacao: null, p_motivo: "odeio", p_descricao: "", p_contato: "",
    });
    assert.equal(error?.code, "22P02");
  });

  test("denúncia de vendedor inexistente", async () => {
    const anon = (await import("../helpers.mjs")).anonimo();
    const { error } = await anon.rpc("enviar_denuncia", {
      p_vendedor: "00000000-0000-0000-0000-000000000000", p_avaliacao: null, p_motivo: "outro", p_descricao: "", p_contato: "",
    });
    assert.match(error?.message ?? "", /vendedor_invalido/);
  });

  test("denúncia longa é cortada em 500/100 em vez de estourar", async () => {
    const anon = (await import("../helpers.mjs")).anonimo();
    const { error } = await anon.rpc("enviar_denuncia", {
      p_vendedor: ze.vendedorId, p_avaliacao: null, p_motivo: "outro", p_descricao: "a".repeat(5000), p_contato: "b".repeat(5000),
    });
    assert.ifError(error);
    const { data } = await admin.from("denuncias").select("descricao, contato").eq("vendedor_id", ze.vendedorId).order("created_at", { ascending: false }).limit(1).single();
    assert.equal(data.descricao.length, 500);
    assert.equal(data.contato.length, 100);
  });

  test("nome de usuário duplicado é recusado pelo banco (23505)", async () => {
    const s = Math.random().toString(16).slice(2, 10);
    const { error } = await admin.auth.admin.createUser({
      email: `dup.${s}@exemplo.com`,
      password: `Senha-${s}-forte`,
      email_confirm: true,
      user_metadata: { username: ze.username, categoria_ids: [] },
    });
    assert.ok(error, "username repetido deve falhar");
  });

  test("username fora do formato é recusado pelo banco", async () => {
    for (const ruim of ["ab", "COM MAIUSCULA", "com espaço", "x".repeat(31), "a@b"]) {
      const s = Math.random().toString(16).slice(2, 10);
      const { error } = await admin.auth.admin.createUser({
        email: `fmt.${s}@exemplo.com`,
        password: `Senha-${s}-forte`,
        email_confirm: true,
        user_metadata: { username: ruim, categoria_ids: [] },
      });
      assert.ok(error, `${JSON.stringify(ruim)} deveria falhar`);
    }
  });
});
