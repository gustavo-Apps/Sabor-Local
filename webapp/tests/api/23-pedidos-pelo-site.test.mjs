// Pedidos pelo site (versão 2.x): regras do banco. O site só mostra; quem decide valor, horário e limites é o banco.

import test, { after, before, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { admin, anonimo, Contexto, zerarLimites } from "../helpers.mjs";

const ctx = new Contexto();
let loja; // aceita pedidos, aberta o dia todo
let outra; // outra loja (para isolamento)
let adm;
let pastel;
let suco;
let semPreco;
let deOutra;

const tel = (n = 1) => `(11) 9${String(80000000 + n).padStart(8, "0")}`;
const linhas = (...l) => l.map(([item_id, quantidade]) => ({ item_id, quantidade }));

const pedir = (extra = {}, cliente = anonimo()) =>
  cliente.rpc("criar_pedido", {
    p_vendedor: loja.vendedorId,
    p_itens: linhas([pastel, 2]),
    p_modo: "entrega",
    p_nome: "Maria da Silva",
    p_telefone: tel(1),
    p_endereco: "Rua das Flores, 100, Centro",
    p_pagamento: "pix",
    p_troco: null,
    p_observacoes: null,
    ...extra,
  });
const ok = async (extra) => {
  const { data, error } = await pedir(extra);
  assert.ifError(error);
  return data;
};
const recusa = async (extra, codigo, cliente) => {
  const { data, error } = await pedir(extra, cliente);
  assert.ok(error, `deveria recusar (${codigo})`);
  assert.match(error.message, new RegExp(codigo), `esperava ${codigo}, veio: ${error.message}`);
  assert.ok(!data);
};
const config = (dados, id = loja.vendedorId) => admin.from("vendedores").update(dados).eq("id", id);
const horarioTodoDia = async (vendedorId) => {
  await admin.from("horarios_funcionamento").delete().eq("vendedor_id", vendedorId);
  const { error } = await admin
    .from("horarios_funcionamento")
    .insert(Array.from({ length: 7 }, (_, dia) => ({ vendedor_id: vendedorId, dia_semana: dia, abre: "00:00", fecha: "00:00" })));
  assert.ifError(error);
};
const pedidoDoBanco = async (numero) =>
  (await admin.from("pedidos").select("*, pedido_itens(*)").eq("vendedor_id", loja.vendedorId).eq("numero", numero).single()).data;
const abertaEm = async (iso, vendedorId = loja.vendedorId) =>
  (await admin.rpc("loja_aberta_agora", { p_vendedor: vendedorId, p_agora: iso })).data;

before(async () => {
  loja = await ctx.novoVendedor({ aprovado: true });
  outra = await ctx.novoVendedor({ aprovado: true });
  adm = await ctx.novoVendedor({ aprovado: true, ehAdmin: true });
  await config({ aceita_pedidos: true, taxa_entrega: 5 });
  await config({ aceita_pedidos: true }, outra.vendedorId);
  await horarioTodoDia(loja.vendedorId);
  await horarioTodoDia(outra.vendedorId);
  const { data } = await admin
    .from("itens_cardapio")
    .insert([
      { vendedor_id: loja.vendedorId, nome: "Pastel", preco: 8.5, ordem: 0 },
      { vendedor_id: loja.vendedorId, nome: "Suco", preco: 6, ordem: 1 },
      { vendedor_id: loja.vendedorId, nome: "Bolo do dia", preco: null, ordem: 2 },
      { vendedor_id: outra.vendedorId, nome: "Hambúrguer", preco: 20, ordem: 0 },
    ])
    .select("id, nome");
  pastel = data.find((i) => i.nome === "Pastel").id;
  suco = data.find((i) => i.nome === "Suco").id;
  semPreco = data.find((i) => i.nome === "Bolo do dia").id;
  deOutra = data.find((i) => i.nome === "Hambúrguer").id;
});
beforeEach(async () => {
  await zerarLimites();
  // o limite por origem conta pedidos de qualquer loja (no ambiente local todo mundo tem o mesmo IP): começa do zero
  await admin.from("pedidos").delete().not("ip_hash", "is", null);
  await admin.from("pedidos").delete().in("vendedor_id", [loja.vendedorId, outra.vendedorId]);
  await admin.from("clientes_bloqueados").delete().eq("vendedor_id", loja.vendedorId);
  await admin.from("itens_cardapio").update({ disponivel: true, indisponivel_ate: null }).in("id", [pastel, suco, semPreco]);
  await config({ aceita_pedidos: true, taxa_entrega: 5, modo_atendimento: "ambos", pagamentos_aceitos: ["pix", "dinheiro", "cartao"], status_manual: "normal", status_manual_ate: null, ativo: true });
});
after(async () => {
  await admin.from("pedidos").delete().in("vendedor_id", [loja.vendedorId, outra.vendedorId]);
  await ctx.limpar();
});

describe("a loja está aberta agora?", () => {
  // 2031-10-06 é segunda-feira. Horários em Brasília (UTC-3).
  const montar = async (vendedor, horarios) => {
    await admin.from("horarios_funcionamento").delete().eq("vendedor_id", vendedor.vendedorId);
    await admin.from("excecoes_horario").delete().eq("vendedor_id", vendedor.vendedorId);
    await admin.from("horarios_funcionamento").insert(horarios.map(([dia_semana, abre, fecha]) => ({ vendedor_id: vendedor.vendedorId, dia_semana, abre, fecha })));
  };
  after(async () => {
    await horarioTodoDia(loja.vendedorId);
    await admin.from("excecoes_horario").delete().eq("vendedor_id", loja.vendedorId);
  });

  test("dentro e fora do horário da segunda", async () => {
    await montar(loja, [[1, "11:00", "14:00"]]);
    assert.equal(await abertaEm("2031-10-06T12:00:00-03:00"), true);
    assert.equal(await abertaEm("2031-10-06T10:59:00-03:00"), false);
    assert.equal(await abertaEm("2031-10-06T14:00:00-03:00"), false, "o minuto de fechar já está fechado");
    assert.equal(await abertaEm("2031-10-07T12:00:00-03:00"), false, "terça não tem horário");
  });

  test("o fuso é o de Brasília, não o do servidor", async () => {
    await montar(loja, [[1, "21:00", "23:00"]]);
    assert.equal(await abertaEm("2031-10-07T01:00:00Z"), true, "01:00 UTC de terça = 22:00 de segunda em Brasília");
    assert.equal(await abertaEm("2031-10-06T22:00:00Z"), false, "22:00 UTC = 19:00 em Brasília");
  });

  test("horário que vira a noite vale na madrugada do dia seguinte", async () => {
    await montar(loja, [[2, "18:00", "02:00"]]); // terça 18h às 2h
    assert.equal(await abertaEm("2031-10-07T23:00:00-03:00"), true);
    assert.equal(await abertaEm("2031-10-08T01:00:00-03:00"), true, "quarta 01:00 ainda é o turno de terça");
    assert.equal(await abertaEm("2031-10-08T02:00:00-03:00"), false);
    assert.equal(await abertaEm("2031-10-07T01:00:00-03:00"), false, "terça 01:00 não é turno de nada");
  });

  test("dois períodos no mesmo dia", async () => {
    await montar(loja, [[1, "11:00", "14:00"], [1, "18:00", "22:00"]]);
    assert.equal(await abertaEm("2031-10-06T12:00:00-03:00"), true);
    assert.equal(await abertaEm("2031-10-06T16:00:00-03:00"), false);
    assert.equal(await abertaEm("2031-10-06T19:00:00-03:00"), true);
  });

  test("data especial fechada ou com outro horário vale mais que o horário semanal", async () => {
    await montar(loja, [[1, "08:00", "20:00"]]);
    await admin.from("excecoes_horario").insert({ vendedor_id: loja.vendedorId, data: "2031-10-06", fechado: true });
    assert.equal(await abertaEm("2031-10-06T12:00:00-03:00"), false);
    await admin.from("excecoes_horario").delete().eq("vendedor_id", loja.vendedorId);
    await admin.from("excecoes_horario").insert({ vendedor_id: loja.vendedorId, data: "2031-10-06", fechado: false, abre: "15:00", fecha: "17:00" });
    assert.equal(await abertaEm("2031-10-06T12:00:00-03:00"), false);
    assert.equal(await abertaEm("2031-10-06T16:00:00-03:00"), true);
  });

  test("férias e 'não abre hoje' fecham até a data; vencidos são ignorados", async () => {
    await montar(loja, [[1, "08:00", "20:00"]]);
    await config({ status_manual: "ferias", status_manual_ate: "2031-10-10" });
    assert.equal(await abertaEm("2031-10-06T12:00:00-03:00"), false);
    await config({ status_manual: "ferias", status_manual_ate: "2031-10-05" });
    assert.equal(await abertaEm("2031-10-06T12:00:00-03:00"), true, "as férias já acabaram");
    await config({ status_manual: "fechado_hoje", status_manual_ate: null });
    assert.equal(await abertaEm("2031-10-06T12:00:00-03:00"), false);
  });

  test("loja suspensa ou inexistente nunca está aberta", async () => {
    await montar(loja, [[1, "08:00", "20:00"]]);
    await config({ ativo: false });
    assert.equal(await abertaEm("2031-10-06T12:00:00-03:00"), false);
    assert.equal(await abertaEm("2031-10-06T12:00:00-03:00", "00000000-0000-0000-0000-000000000000"), false);
  });

  test("só o servidor chama (visitante e vendedor não)", async () => {
    for (const cliente of [anonimo(), loja.client]) {
      const { error } = await cliente.rpc("loja_aberta_agora", { p_vendedor: loja.vendedorId });
      assert.ok(error);
    }
  });
});

describe("fazer um pedido", () => {
  test("o banco calcula o valor: itens x quantidade + taxa de entrega", async () => {
    const r = await ok({ p_itens: linhas([pastel, 2], [suco, 1]) });
    assert.equal(Number(r.subtotal), 23);
    assert.equal(Number(r.taxa_entrega), 5);
    assert.equal(Number(r.total), 28);
    assert.equal(r.numero, 1);
    assert.match(r.token, /^[0-9a-f]{64}$/);
  });

  test("retirada não paga taxa e não guarda endereço", async () => {
    const r = await ok({ p_modo: "retirada", p_endereco: "Rua que não deveria ficar" });
    assert.equal(Number(r.total), 17);
    const p = await pedidoDoBanco(r.numero);
    assert.equal(p.endereco, null);
    assert.equal(Number(p.taxa_entrega), 0);
  });

  test("o cliente não escolhe preço: campos extras nos itens são ignorados", async () => {
    const r = await ok({ p_itens: [{ item_id: pastel, quantidade: 1, preco: 0.01, preco_unit: 0.01 }] });
    assert.equal(Number(r.subtotal), 8.5);
  });

  test("o preço fica congelado: mudar o cardápio depois não altera o pedido", async () => {
    const r = await ok();
    await admin.from("itens_cardapio").update({ preco: 99, nome: "Pastel Premium" }).eq("id", pastel);
    const p = await pedidoDoBanco(r.numero);
    assert.equal(Number(p.pedido_itens[0].preco_unit), 8.5);
    assert.equal(p.pedido_itens[0].nome, "Pastel");
    assert.equal(Number(p.total), 22);
    await admin.from("itens_cardapio").update({ preco: 8.5, nome: "Pastel" }).eq("id", pastel);
  });

  test("item sem preço entra como 'sob consulta' e avisa que o valor final se combina", async () => {
    const r = await ok({ p_itens: linhas([pastel, 1], [semPreco, 1]) });
    assert.equal(r.tem_item_sob_consulta, true);
    assert.equal(Number(r.subtotal), 8.5);
    const p = await pedidoDoBanco(r.numero);
    assert.equal(p.pedido_itens.find((i) => i.nome === "Bolo do dia").preco_unit, null);
  });

  test("o número do pedido sobe de 1 em 1 dentro de cada loja", async () => {
    const a = await ok({ p_telefone: tel(1) });
    const b = await ok({ p_telefone: tel(2) });
    const c = await anonimo().rpc("criar_pedido", {
      p_vendedor: outra.vendedorId, p_itens: linhas([deOutra, 1]), p_modo: "retirada", p_nome: "João Souza",
      p_telefone: tel(3), p_endereco: null, p_pagamento: "pix", p_troco: null, p_observacoes: null,
    });
    assert.deepEqual([a.numero, b.numero, c.data.numero], [1, 2, 1]);
  });

  test("telefone sem 55 ganha o 55, e nome e observações saem limpos", async () => {
    const r = await ok({ p_telefone: "11 98000-0001", p_nome: "  Maria   da\u0007 Silva ", p_observacoes: "  sem   cebola\ncampainha  estragada " });
    const p = await pedidoDoBanco(r.numero);
    assert.equal(p.cliente_telefone, "5511980000001");
    assert.equal(p.cliente_nome, "Maria da Silva");
    assert.equal(p.observacoes, "sem cebola campainha estragada");
  });

  test("troco para dinheiro, pelo menos o valor do pedido", async () => {
    const r = await ok({ p_pagamento: "dinheiro", p_troco: 50 });
    assert.equal(Number((await pedidoDoBanco(r.numero)).troco_para), 50);
  });

  test("troco que o cliente mandou com outro meio de pagamento é descartado", async () => {
    const r = await ok({ p_pagamento: "pix", p_troco: 50 });
    assert.equal((await pedidoDoBanco(r.numero)).troco_para, null);
  });
});

describe("o que o banco recusa", () => {
  test("loja que não liga os pedidos, suspensa ou inexistente", async () => {
    await config({ aceita_pedidos: false });
    await recusa({}, "loja_nao_aceita_pedidos");
    await config({ aceita_pedidos: true, ativo: false });
    await recusa({}, "loja_nao_aceita_pedidos");
    await recusa({ p_vendedor: "00000000-0000-0000-0000-000000000000" }, "loja_nao_aceita_pedidos");
  });

  test("loja fechada, de férias ou que não abre hoje", async () => {
    await config({ status_manual: "fechado_hoje" });
    await recusa({}, "loja_fechada");
    await config({ status_manual: "ferias", status_manual_ate: "2099-01-01" });
    await recusa({}, "loja_fechada");
  });

  test("o dono não faz pedido na própria loja", async () => {
    await recusa({}, "loja_propria", loja.client);
  });

  test("itens: vazio, não é lista, repetido, quantidade ruim, de outra loja, inexistente, 31 linhas", async () => {
    await recusa({ p_itens: [] }, "itens_invalidos");
    await recusa({ p_itens: { item_id: pastel } }, "itens_invalidos");
    await recusa({ p_itens: null }, "itens_invalidos");
    await recusa({ p_itens: linhas([pastel, 1], [pastel, 1]) }, "itens_invalidos");
    for (const q of [0, 21, -1, 1.5, "a", null]) await recusa({ p_itens: [{ item_id: pastel, quantidade: q }] }, "itens_invalidos");
    await recusa({ p_itens: [{ item_id: "nao-e-uuid", quantidade: 1 }] }, "itens_invalidos");
    await recusa({ p_itens: [{ quantidade: 1 }] }, "itens_invalidos");
    await recusa({ p_itens: linhas([deOutra, 1]) }, "item_indisponivel");
    await recusa({ p_itens: linhas(["00000000-0000-0000-0000-000000000000", 1]) }, "item_indisponivel");
    const muitos = Array.from({ length: 31 }, () => ({ item_id: crypto.randomUUID(), quantidade: 1 }));
    await recusa({ p_itens: muitos }, "itens_invalidos");
  });

  test("item indisponível hoje ou sem previsão não pode ser pedido, e volta a poder depois da data", async () => {
    await admin.from("itens_cardapio").update({ disponivel: false, indisponivel_ate: null }).eq("id", pastel);
    await recusa({}, "item_indisponivel");
    await admin.from("itens_cardapio").update({ disponivel: false, indisponivel_ate: "2099-01-01" }).eq("id", pastel);
    await recusa({}, "item_indisponivel");
    await admin.from("itens_cardapio").update({ disponivel: false, indisponivel_ate: "2000-01-01" }).eq("id", pastel);
    await ok(); // a data já passou: o item voltou sozinho
  });

  test("modo que a loja não atende", async () => {
    await config({ modo_atendimento: "retirada" });
    await recusa({ p_modo: "entrega" }, "modo_invalido");
    await ok({ p_modo: "retirada" });
    await config({ modo_atendimento: "entrega" });
    await recusa({ p_modo: "retirada", p_telefone: tel(2) }, "modo_invalido");
    await recusa({ p_modo: "voando" }, "modo_invalido");
  });

  test("nome, telefone e endereço", async () => {
    for (const nome of ["", "A", "x".repeat(61), null]) await recusa({ p_nome: nome }, "nome_invalido");
    for (const t of ["", "123", "(10) 98000-0001", "abcdefghijk", "55119800000011111"]) await recusa({ p_telefone: t }, "telefone_invalido");
    await recusa({ p_endereco: null }, "endereco_obrigatorio");
    await recusa({ p_endereco: "Rua" }, "endereco_obrigatorio");
    await recusa({ p_endereco: "R".repeat(201) }, "endereco_longo");
    await recusa({ p_observacoes: "o".repeat(301) }, "observacoes_longas");
  });

  test("pagamento que a loja não aceita", async () => {
    await config({ pagamentos_aceitos: ["pix"] });
    await recusa({ p_pagamento: "dinheiro" }, "pagamento_invalido");
    await recusa({ p_pagamento: "cheque" }, "pagamento_invalido");
    await recusa({ p_pagamento: null }, "pagamento_invalido");
    await ok({ p_pagamento: "pix" });
  });

  test("troco menor que o valor, absurdo, e pedido gigante", async () => {
    await recusa({ p_pagamento: "dinheiro", p_troco: 10 }, "troco_invalido");
    await recusa({ p_pagamento: "dinheiro", p_troco: 10001 }, "troco_invalido");
    await admin.from("itens_cardapio").update({ preco: 600 }).eq("id", pastel);
    await recusa({ p_itens: linhas([pastel, 10]) }, "pedido_grande");
    await admin.from("itens_cardapio").update({ preco: 8.5 }).eq("id", pastel);
  });
});

describe("contra pedido falso", () => {
  test("no máximo 3 pedidos por hora do mesmo telefone na mesma loja", async () => {
    for (let i = 0; i < 3; i++) await ok({ p_telefone: tel(7) });
    await recusa({ p_telefone: tel(7) }, "muitos_pedidos");
    await ok({ p_telefone: tel(8) });
  });

  test("no máximo 5 pedidos por hora da mesma origem (IP)", async () => {
    for (let i = 0; i < 5; i++) await ok({ p_telefone: tel(20 + i) });
    await recusa({ p_telefone: tel(30) }, "muitos_pedidos");
  });

  test("a loja recusa e bloqueia o telefone: novos pedidos dele são barrados, os dos outros não", async () => {
    const r = await ok({ p_telefone: tel(40) });
    const { data: p } = await admin.from("pedidos").select("id").eq("vendedor_id", loja.vendedorId).eq("numero", r.numero).single();
    const { data } = await loja.client.rpc("recusar_e_bloquear_pedido", { p_pedido: p.id, p_motivo: "Trote" });
    assert.equal(data, "ok");
    const feito = await pedidoDoBanco(r.numero);
    assert.equal(feito.status, "cancelado");
    assert.equal(feito.cancelado_por, "loja");
    assert.equal(feito.motivo_cancelamento, "Trote");
    await recusa({ p_telefone: tel(40) }, "cliente_bloqueado");
    await recusa({ p_telefone: "11 98000-0040" }, "cliente_bloqueado"); // outra grafia do mesmo número
    await ok({ p_telefone: tel(41) });
    const { data: lista } = await loja.client.from("clientes_bloqueados").select("telefone_final, telefone_hash");
    assert.equal(lista.length, 1);
    assert.equal(lista[0].telefone_final, "0040");
    assert.ok(!JSON.stringify(lista).includes("5511980000040"), "o telefone inteiro não fica guardado");
  });

  test("o bloqueio é só da loja que bloqueou, e dá para desbloquear", async () => {
    const r = await ok({ p_telefone: tel(50) });
    const { data: p } = await admin.from("pedidos").select("id").eq("vendedor_id", loja.vendedorId).eq("numero", r.numero).single();
    await loja.client.rpc("recusar_e_bloquear_pedido", { p_pedido: p.id });
    const naOutra = await anonimo().rpc("criar_pedido", {
      p_vendedor: outra.vendedorId, p_itens: linhas([deOutra, 1]), p_modo: "retirada", p_nome: "Maria da Silva",
      p_telefone: tel(50), p_endereco: null, p_pagamento: "pix", p_troco: null, p_observacoes: null,
    });
    assert.ifError(naOutra.error);
    await loja.client.from("clientes_bloqueados").delete().eq("vendedor_id", loja.vendedorId);
    await ok({ p_telefone: tel(50) });
  });

  test("só o dono bloqueia", async () => {
    const r = await ok({ p_telefone: tel(60) });
    const { data: p } = await admin.from("pedidos").select("id").eq("vendedor_id", loja.vendedorId).eq("numero", r.numero).single();
    for (const cliente of [outra.client, anonimo()]) {
      const { data, error } = await cliente.rpc("recusar_e_bloquear_pedido", { p_pedido: p.id });
      assert.ok(error || data === "pedido_invalido");
    }
    assert.equal((await admin.from("clientes_bloqueados").select("*").eq("vendedor_id", loja.vendedorId)).data.length, 0);
  });
});

describe("o cliente acompanha pelo link", () => {
  const acompanhar = async (token) => (await anonimo().rpc("pedido_por_token", { p_token: token })).data;

  test("mostra o pedido, a loja e o que foi pedido", async () => {
    const r = await ok({ p_itens: linhas([pastel, 2], [suco, 1]), p_observacoes: "sem cebola" });
    const d = await acompanhar(r.token);
    assert.equal(d.estado, "ok");
    assert.equal(d.status, "novo");
    assert.equal(d.numero, 1);
    assert.equal(Number(d.total), 28);
    assert.equal(d.observacoes, "sem cebola");
    assert.equal(d.loja.id, loja.vendedorId);
    assert.equal(typeof d.moderada, "boolean", "a página sabe se a avaliação passa por conferência");
    assert.deepEqual(d.itens.map((i) => [i.nome, i.quantidade]).sort(), [["Pastel", 2], ["Suco", 1]]);
    assert.ok(!JSON.stringify(d).includes("token_hash"));
  });

  test("link errado, vazio ou parecido não mostra nada", async () => {
    const r = await ok();
    for (const t of ["", "abc", r.token.slice(0, 63), r.token.toUpperCase().replace(/[a-f]/gi, "0"), null]) {
      assert.deepEqual(await acompanhar(t), { estado: "invalido" });
    }
  });

  test("o banco guarda só o hash do link", async () => {
    const r = await ok();
    const p = await pedidoDoBanco(r.numero);
    assert.notEqual(p.token_hash, r.token);
    assert.match(p.token_hash, /^[0-9a-f]{64}$/);
  });

  test("o cliente cancela enquanto a loja não começou", async () => {
    const r = await ok();
    assert.equal((await anonimo().rpc("cancelar_pedido_cliente", { p_token: r.token })).data, "ok");
    const d = await acompanhar(r.token);
    assert.equal(d.status, "cancelado");
    assert.equal(d.cancelado_por, "cliente");
    assert.equal((await anonimo().rpc("cancelar_pedido_cliente", { p_token: r.token })).data, "nao_pode_cancelar");
  });

  test("depois que a loja começou, só a loja cancela", async () => {
    const r = await ok();
    const p = await pedidoDoBanco(r.numero);
    await loja.client.rpc("mudar_status_pedido", { p_pedido: p.id, p_status: "em_preparo" });
    assert.equal((await anonimo().rpc("cancelar_pedido_cliente", { p_token: r.token })).data, "nao_pode_cancelar");
    assert.equal((await anonimo().rpc("cancelar_pedido_cliente", { p_token: "lixo" })).data, "pedido_invalido");
  });
});

describe("a loja muda o status", () => {
  const mudar = (cliente, id, status, motivo) => cliente.rpc("mudar_status_pedido", { p_pedido: id, p_status: status, p_motivo: motivo ?? null });
  const novo = async (extra) => {
    const r = await ok(extra);
    return { ...r, id: (await pedidoDoBanco(r.numero)).id };
  };

  test("entrega: novo > em preparo > saiu para entrega > concluído", async () => {
    const p = await novo();
    assert.equal((await mudar(loja.client, p.id, "em_preparo")).data, "ok");
    assert.equal((await mudar(loja.client, p.id, "saiu_para_entrega")).data, "ok");
    assert.equal((await mudar(loja.client, p.id, "concluido")).data, "ok");
    const feito = await pedidoDoBanco(p.numero);
    assert.equal(feito.status, "concluido");
    assert.ok(feito.encerrado_em);
  });

  test("retirada usa 'pronto para retirada', e entrega não aceita esse", async () => {
    const e = await novo();
    assert.equal((await mudar(loja.client, e.id, "pronto_para_retirada")).data, "transicao_invalida");
    const r = await novo({ p_modo: "retirada", p_telefone: tel(2) });
    assert.equal((await mudar(loja.client, r.id, "saiu_para_entrega")).data, "transicao_invalida");
    assert.equal((await mudar(loja.client, r.id, "pronto_para_retirada")).data, "ok", "pode pular o 'em preparo'");
  });

  test("não volta atrás, não pula o fim e não mexe em pedido encerrado", async () => {
    const p = await novo();
    assert.equal((await mudar(loja.client, p.id, "concluido")).data, "transicao_invalida");
    await mudar(loja.client, p.id, "em_preparo");
    assert.equal((await mudar(loja.client, p.id, "novo")).data, "transicao_invalida");
    assert.equal((await mudar(loja.client, p.id, "inventado")).data, "transicao_invalida");
    await mudar(loja.client, p.id, "cancelado", "Acabou o gás");
    assert.equal((await mudar(loja.client, p.id, "em_preparo")).data, "transicao_invalida");
    const feito = await pedidoDoBanco(p.numero);
    assert.equal(feito.cancelado_por, "loja");
    assert.equal(feito.motivo_cancelamento, "Acabou o gás");
  });

  test("só o dono da loja muda; visitante e outra loja não", async () => {
    const p = await novo();
    assert.equal((await mudar(outra.client, p.id, "em_preparo")).data, "pedido_invalido");
    assert.ok((await mudar(anonimo(), p.id, "em_preparo")).error);
    assert.equal((await pedidoDoBanco(p.numero)).status, "novo");
  });

  test("ninguém grava direto na tabela de pedidos", async () => {
    const p = await novo();
    const up = await loja.client.from("pedidos").update({ status: "concluido", total: 0 }).eq("id", p.id).select();
    assert.equal(up.data?.length ?? 0, 0);
    const ins = await loja.client.from("pedidos").insert({ vendedor_id: loja.vendedorId, numero: 99, token_hash: "x", modo: "retirada", pagamento: "pix", subtotal: 0, total: 0 });
    assert.ok(ins.error);
    const del = await loja.client.from("pedidos").delete().eq("id", p.id).select();
    assert.equal(del.data?.length ?? 0, 0);
    assert.equal((await pedidoDoBanco(p.numero)).status, "novo");
  });
});

describe("quem enxerga os dados do cliente", () => {
  test("o dono lê os pedidos e os itens da própria loja", async () => {
    await ok({ p_itens: linhas([pastel, 1], [suco, 1]) });
    const { data } = await loja.client.from("pedidos").select("numero, cliente_nome, cliente_telefone, endereco, pedido_itens(nome, quantidade)");
    assert.equal(data.length, 1);
    assert.equal(data[0].cliente_nome, "Maria da Silva");
    assert.equal(data[0].pedido_itens.length, 2);
  });

  test("outro vendedor, visitante e até o administrador não leem dados de clientes", async () => {
    await ok();
    for (const cliente of [outra.client, anonimo(), adm.client]) {
      const { data: pedidos } = await cliente.from("pedidos").select("*");
      const { data: itens } = await cliente.from("pedido_itens").select("*");
      assert.equal(pedidos?.length ?? 0, 0);
      assert.equal(itens?.length ?? 0, 0);
    }
  });

  test("o histórico do pedido não guarda nome, telefone nem endereço", async () => {
    const r = await ok({ p_nome: "Fulana Secreta", p_telefone: tel(77), p_endereco: "Rua Secreta, 1" });
    const p = await pedidoDoBanco(r.numero);
    const { data } = await admin.from("historico").select("dados").eq("entidade", "pedidos").eq("entidade_id", p.id);
    assert.ok(data.length >= 1);
    const texto = JSON.stringify(data);
    for (const segredo of ["Fulana", "Secreta", "98000", "Rua"]) assert.ok(!texto.includes(segredo), segredo);
    assert.deepEqual(Object.keys(data[0].dados).sort(), ["modo", "numero", "status", "total"]);
  });
});

describe("avaliar o pedido concluído", () => {
  const avaliar = (token, extra = {}) => anonimo().rpc("avaliar_por_pedido", { p_token: token, p_nota: 5, p_comentario: "Chegou quentinho", ...extra });
  const concluir = async (extra) => {
    const r = await ok(extra);
    const p = await pedidoDoBanco(r.numero);
    await loja.client.rpc("mudar_status_pedido", { p_pedido: p.id, p_status: "em_preparo" });
    await loja.client.rpc("mudar_status_pedido", { p_pedido: p.id, p_status: p.modo === "entrega" ? "saiu_para_entrega" : "pronto_para_retirada" });
    await loja.client.rpc("mudar_status_pedido", { p_pedido: p.id, p_status: "concluido" });
    return { ...r, id: p.id };
  };
  after(async () => {
    await admin.from("avaliacoes").delete().eq("vendedor_id", loja.vendedorId);
  });
  beforeEach(async () => {
    await admin.from("avaliacoes").delete().eq("vendedor_id", loja.vendedorId);
    await admin.from("configuracoes").update({ avaliacoes_exigem_aprovacao: true }).eq("id", true);
  });

  test("só depois de concluído, uma única vez, e o link do pedido é a verificação de compra", async () => {
    const aberto = await ok({ p_telefone: tel(2) });
    assert.equal((await avaliar(aberto.token)).data, "pedido_nao_concluido");
    const r = await concluir();
    const d = (await anonimo().rpc("pedido_por_token", { p_token: r.token })).data;
    assert.equal(d.pode_avaliar, true);
    assert.equal((await avaliar(r.token, { p_nome: "Maria" })).data, "ok");
    assert.equal((await avaliar(r.token)).data, "pedido_ja_avaliado");
    const { data: av } = await admin.from("avaliacoes").select("*").eq("vendedor_id", loja.vendedorId);
    assert.equal(av.length, 1);
    assert.equal(av[0].autor_nome, "Maria");
    assert.equal(av[0].aprovada, false, "continua passando pela conferência da equipe");
    assert.equal(av[0].codigo_verificacao, `pedido-${r.id}`);
    const depois = (await anonimo().rpc("pedido_por_token", { p_token: r.token })).data;
    assert.equal(depois.pode_avaliar, false);
    assert.equal(depois.avaliado, true);
  });

  test("com a aprovação desligada, a avaliação já nasce publicada", async () => {
    await admin.from("configuracoes").update({ avaliacoes_exigem_aprovacao: false }).eq("id", true);
    const r = await concluir();
    await avaliar(r.token);
    const { data } = await anonimo().from("avaliacoes").select("nota").eq("vendedor_id", loja.vendedorId);
    assert.equal(data.length, 1);
    await admin.from("configuracoes").update({ avaliacoes_exigem_aprovacao: true }).eq("id", true);
  });

  test("cancelado não avalia, link errado e dados ruins são recusados sem gastar o direito", async () => {
    const c = await ok({ p_telefone: tel(2) });
    await anonimo().rpc("cancelar_pedido_cliente", { p_token: c.token });
    assert.equal((await avaliar(c.token)).data, "pedido_nao_concluido");
    assert.equal((await avaliar("lixo")).data, "pedido_invalido");
    const r = await concluir({ p_telefone: tel(3) });
    assert.equal((await avaliar(r.token, { p_nota: 6 })).data, "nota_invalida");
    assert.equal((await avaliar(r.token, { p_comentario: "x".repeat(501) })).data, "comentario_longo");
    assert.equal((await avaliar(r.token, { p_nome: "ana@mail.com" })).data, "nome_invalido");
    assert.equal((await avaliar(r.token, { p_nome: "n".repeat(41) })).data, "nome_longo");
    assert.equal((await avaliar(r.token)).data, "ok");
  });
});

describe("números e 'mais pedido'", () => {
  const concluirN = async (n, itens, telBase) => {
    for (let i = 0; i < n; i++) {
      const r = await ok({ p_itens: itens, p_telefone: tel(telBase + i) });
      const p = await pedidoDoBanco(r.numero);
      for (const s of ["em_preparo", "saiu_para_entrega", "concluido"]) await loja.client.rpc("mudar_status_pedido", { p_pedido: p.id, p_status: s });
    }
  };
  const ranking = async () => (await anonimo().rpc("itens_mais_pedidos", { p_vendedor: loja.vendedorId })).data.map((r) => r.item_id);

  test("o vendedor vê o resumo dele; outro vendedor e visitante não veem o de outrem", async () => {
    await ok({ p_telefone: tel(1) });
    await concluirN(1, linhas([pastel, 1]), 10);
    const { data } = await loja.client.rpc("meus_pedidos_resumo", { p_dias: 30 });
    assert.equal(data.pedidos, 2);
    assert.equal(data.novos, 1);
    assert.equal(data.concluidos, 1);
    assert.equal(Number(data.valor_concluido), 13.5);
    assert.equal((await outra.client.rpc("meus_pedidos_resumo", {})).data.pedidos, 0);
    assert.ok((await anonimo().rpc("meus_pedidos_resumo", {})).data?.pedidos === 0 || (await anonimo().rpc("meus_pedidos_resumo", {})).error);
  });

  test("o administrador vê números gerais, sem dados de clientes", async () => {
    await concluirN(1, linhas([pastel, 1]), 10);
    const { data, error } = await adm.client.rpc("admin_pedidos_resumo", { p_dias: 30 });
    assert.ifError(error);
    assert.ok(data.pedidos >= 1 && data.lojas_aceitando >= 1);
    assert.ok(data.lojas.some((l) => l.id === loja.vendedorId));
    assert.ok(!JSON.stringify(data).includes("Maria"));
    assert.ok((await loja.client.rpc("admin_pedidos_resumo", {})).error);
    assert.ok((await anonimo().rpc("admin_pedidos_resumo", {})).error);
  });

  test("'mais pedido' pelo volume real: item de 3 pedidos concluídos, ordenado pela quantidade", async () => {
    await concluirN(3, linhas([pastel, 3], [suco, 1]), 10);
    await concluirN(1, linhas([semPreco, 9]), 20); // só 1 pedido: não basta
    await admin.from("pedido_itens").update({ quantidade: 1 }).eq("nome", "Suco");
    assert.deepEqual(await ranking(), [pastel, suco]);
  });

  test("pedido cancelado ou ainda aberto não conta", async () => {
    for (let i = 0; i < 3; i++) await ok({ p_itens: linhas([pastel, 1]), p_telefone: tel(30 + i) });
    assert.deepEqual(await ranking(), []);
  });

  test("sem volume de pedidos, continuam valendo os toques em 'Pedir' (regra anterior)", async () => {
    const linhasToque = Array.from({ length: 5 }, (_, i) => ({ tipo: "pedir_item", vendedor_id: loja.vendedorId, item_id: suco, ip_hash: `t-${i}` }));
    await admin.from("eventos").insert(linhasToque);
    assert.deepEqual(await ranking(), [suco]);
    await admin.from("eventos").delete().eq("vendedor_id", loja.vendedorId).eq("tipo", "pedir_item");
  });
});

describe("retenção dos dados do cliente (LGPD)", () => {
  const idade = async (numero, dias, campo = "encerrado_em") => {
    const quando = new Date(Date.now() - dias * 86400000).toISOString();
    await admin.from("pedidos").update({ [campo]: quando, ...(campo === "encerrado_em" ? { criado_em: quando } : {}) }).eq("vendedor_id", loja.vendedorId).eq("numero", numero);
  };

  test("pedido encerrado há mais de 90 dias perde nome, telefone, endereço e observações, mas mantém os números", async () => {
    const r = await ok({ p_observacoes: "portão azul" });
    const p = await pedidoDoBanco(r.numero);
    await loja.client.rpc("mudar_status_pedido", { p_pedido: p.id, p_status: "cancelado" });
    await idade(r.numero, 91);
    const { data } = await admin.rpc("limpar_dados_antigos");
    assert.ok(data.pedidos_dados_pessoais_removidos >= 1);
    const depois = await pedidoDoBanco(r.numero);
    for (const campo of ["cliente_nome", "cliente_telefone", "endereco", "observacoes", "troco_para"]) assert.equal(depois[campo], null, campo);
    assert.equal(Number(depois.total), 22);
    assert.equal(depois.pedido_itens.length, 1);
  });

  test("pedido encerrado há menos de 90 dias mantém tudo", async () => {
    const r = await ok();
    const p = await pedidoDoBanco(r.numero);
    await loja.client.rpc("mudar_status_pedido", { p_pedido: p.id, p_status: "cancelado" });
    await idade(r.numero, 30);
    await admin.rpc("limpar_dados_antigos");
    assert.equal((await pedidoDoBanco(r.numero)).cliente_nome, "Maria da Silva");
  });

  test("pedido novo sem resposta há mais de 3 dias vence sozinho", async () => {
    const r = await ok();
    await idade(r.numero, 4, "criado_em");
    await admin.rpc("limpar_dados_antigos");
    const p = await pedidoDoBanco(r.numero);
    assert.equal(p.status, "cancelado");
    assert.equal(p.cancelado_por, "sistema");
    assert.ok(p.encerrado_em);
    assert.ok(p.ip_hash, "com 4 dias o IP ainda é guardado (some depois de 7)");
  });

  test("o IP some do pedido depois de 7 dias", async () => {
    const r = await ok();
    await idade(r.numero, 8, "criado_em");
    await admin.rpc("limpar_dados_antigos");
    assert.equal((await pedidoDoBanco(r.numero)).ip_hash, null);
  });

  test("a rotina de limpeza não é pública", async () => {
    for (const cliente of [anonimo(), loja.client, adm.client]) assert.ok((await cliente.rpc("limpar_dados_antigos")).error);
  });

  test("excluir a conta do vendedor apaga os pedidos dele", async () => {
    const temp = await ctx.novoVendedor({ aprovado: true });
    await config({ aceita_pedidos: true }, temp.vendedorId);
    await horarioTodoDia(temp.vendedorId);
    const { data: i } = await admin.from("itens_cardapio").insert({ vendedor_id: temp.vendedorId, nome: "X", preco: 5 }).select("id").single();
    const r = await anonimo().rpc("criar_pedido", {
      p_vendedor: temp.vendedorId, p_itens: linhas([i.id, 1]), p_modo: "retirada", p_nome: "Maria da Silva",
      p_telefone: tel(90), p_endereco: null, p_pagamento: "pix", p_troco: null, p_observacoes: null,
    });
    assert.ifError(r.error);
    await admin.from("vendedores").delete().eq("id", temp.vendedorId);
    assert.equal((await admin.from("pedidos").select("id").eq("vendedor_id", temp.vendedorId)).data.length, 0);
  });
});
