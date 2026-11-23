// Pedido pelo site: totais, status, mensagem do WhatsApp, mensagens de erro e validações (sem banco, sem rede).

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  calcularTotais,
  ERRO_PEDIDO_PADRAO,
  linkWhatsAppComTexto,
  mensagemErroDoPedido,
  montarResumoParaWhatsApp,
  pedidoAberto,
  podeCancelarNaLoja,
  proximasAcoes,
  rotuloDoStatusParaCliente,
} from "../../src/lib/pedidos.ts";
import { validarConfigPedidos, validarPedido } from "../../src/lib/validacao.ts";

describe("calcularTotais", () => {
  const linhas = [
    { nome: "Pastel", preco: 8.5, quantidade: 2 },
    { nome: "Suco", preco: 6, quantidade: 1 },
  ];
  test("itens x quantidade, mais a taxa quando é entrega", () => {
    assert.deepEqual(calcularTotais(linhas, "entrega", 5), { quantidade: 3, subtotal: 23, taxaEntrega: 5, total: 28, sobConsulta: false });
  });
  test("retirada não paga taxa", () => {
    const t = calcularTotais(linhas, "retirada", 5);
    assert.equal(t.taxaEntrega, 0);
    assert.equal(t.total, 23);
  });
  test("item sem preço marca 'sob consulta' e não soma", () => {
    const t = calcularTotais([...linhas, { nome: "Bolo", preco: null, quantidade: 4 }], "retirada", 0);
    assert.equal(t.sobConsulta, true);
    assert.equal(t.subtotal, 23);
    assert.equal(t.quantidade, 7);
  });
  test("centavos não acumulam erro de ponto flutuante", () => {
    const t = calcularTotais([{ nome: "Bala", preco: 0.1, quantidade: 3 }], "retirada", 0);
    assert.equal(t.subtotal, 0.3);
    assert.equal(calcularTotais([{ nome: "X", preco: 19.99, quantidade: 3 }], "retirada", 0).total, 59.97);
  });
  test("carrinho vazio", () => {
    assert.deepEqual(calcularTotais([], "entrega", 5), { quantidade: 0, subtotal: 0, taxaEntrega: 5, total: 5, sobConsulta: false });
  });
});

describe("status do pedido", () => {
  const rotulos = (modo, status) => proximasAcoes(modo, status).map((a) => a.status);

  test("entrega: novo > em preparo > saiu para entrega > concluído", () => {
    assert.deepEqual(rotulos("entrega", "novo"), ["em_preparo", "saiu_para_entrega"]);
    assert.deepEqual(rotulos("entrega", "em_preparo"), ["saiu_para_entrega"]);
    assert.deepEqual(rotulos("entrega", "saiu_para_entrega"), ["concluido"]);
  });
  test("retirada usa 'pronto para retirar'", () => {
    assert.deepEqual(rotulos("retirada", "novo"), ["em_preparo", "pronto_para_retirada"]);
    assert.deepEqual(rotulos("retirada", "pronto_para_retirada"), ["concluido"]);
  });
  test("pedido encerrado ou status estranho não oferece botão", () => {
    for (const s of ["concluido", "cancelado", "inventado", ""]) assert.deepEqual(proximasAcoes("entrega", s), []);
  });
  test("só pedido aberto se cancela e conta como aberto", () => {
    for (const s of ["novo", "em_preparo", "saiu_para_entrega", "pronto_para_retirada"]) {
      assert.equal(pedidoAberto(s), true);
      assert.equal(podeCancelarNaLoja(s), true);
    }
    for (const s of ["concluido", "cancelado", "x"]) assert.equal(pedidoAberto(s), false);
  });
  test("texto para o cliente de cada status", () => {
    assert.match(rotuloDoStatusParaCliente("novo"), /Aguardando/);
    assert.match(rotuloDoStatusParaCliente("saiu_para_entrega"), /Saiu para entrega/);
    assert.equal(rotuloDoStatusParaCliente("estranho"), "estranho");
  });
});

describe("mensagem de erro do pedido", () => {
  test("cada código do banco vira um texto claro", () => {
    for (const codigo of ["loja_fechada", "item_indisponivel", "muitos_pedidos", "troco_invalido", "pagamento_invalido", "telefone_invalido"]) {
      const texto = mensagemErroDoPedido(`P0001: ${codigo}`);
      assert.notEqual(texto, ERRO_PEDIDO_PADRAO, codigo);
      assert.ok(!texto.includes("_"), `${codigo}: nada de código técnico para o cliente`);
    }
  });
  test("pedido de cliente bloqueado não revela o bloqueio", () => {
    const texto = mensagemErroDoPedido("cliente_bloqueado");
    assert.ok(!/bloque/i.test(texto));
  });
  test("erro desconhecido ou vazio cai na mensagem padrão", () => {
    for (const e of [undefined, null, "", "connection refused", "{\"x\":1}"]) assert.equal(mensagemErroDoPedido(e), ERRO_PEDIDO_PADRAO);
  });
});

describe("resumo para o WhatsApp", () => {
  const base = {
    numero: 12,
    nome: "Maria da Silva",
    modo: "entrega",
    endereco: "Rua das Flores, 100",
    pagamento: "dinheiro",
    troco: 50,
    observacoes: "sem cebola",
    linhas: [
      { nome: "Pastel de carne", preco: 8.5, quantidade: 2 },
      { nome: "Bolo do dia", preco: null, quantidade: 1 },
    ],
    totais: { quantidade: 3, subtotal: 17, taxaEntrega: 5, total: 22, sobConsulta: true },
  };
  const texto = montarResumoParaWhatsApp("Salgados da Tia Fran", base);

  test("traz o número, os itens, o total, o endereço, o pagamento com troco e as observações", () => {
    for (const trecho of ["pedido nº 12", "2x Pastel de carne", "1x Bolo do dia (valor a combinar)", "+ itens a combinar", "Rua das Flores, 100", "troco para", "sem cebola", "Maria da Silva"]) {
      assert.ok(texto.includes(trecho), trecho);
    }
    assert.match(texto, /Entrega: R\$\s?5,00/);
    assert.match(texto, /Total: R\$\s?22,00/);
  });
  test("retirada não fala de endereço nem de taxa", () => {
    const t = montarResumoParaWhatsApp("Loja", { ...base, modo: "retirada", endereco: null, totais: { ...base.totais, taxaEntrega: 0, total: 17 } });
    assert.ok(t.includes("Retirada na loja"));
    assert.ok(!t.includes("Entrega:"));
    assert.ok(!t.includes("Rua das Flores"));
  });
  test("nunca leva o link de acompanhamento (ele é só do cliente: cancela e avalia)", () => {
    assert.ok(!/\/pedido\//.test(texto));
    assert.ok(!/[0-9a-f]{64}/.test(texto));
  });
  test("o link do WhatsApp codifica & # e quebras de linha sem cortar a mensagem", () => {
    const url = linkWhatsAppComTexto("(55) 99999-0000", "Pão & Café #1\nlinha 2");
    assert.ok(url.startsWith("https://wa.me/5599999000"));
    assert.equal(decodeURIComponent(url.split("text=")[1]), "Pão & Café #1\nlinha 2");
    assert.ok(!url.split("text=")[1].includes("&"));
  });
});

describe("validarPedido", () => {
  const loja = { modoAtendimento: "ambos", pagamentosAceitos: ["pix", "dinheiro"], total: 28 };
  const bom = { modo: "entrega", nome: "Maria da Silva", telefone: "(11) 98000-0001", endereco: "Rua das Flores, 100", pagamento: "pix", troco: "", observacoes: "" };
  const erro = (r) => (r.ok ? null : r.erro);

  test("pedido certo devolve os campos do banco, com telefone e texto limpos", () => {
    const r = validarPedido({ ...bom, nome: "  Maria   da Silva ", observacoes: " sem   cebola\n" }, loja);
    assert.equal(r.ok, true);
    assert.deepEqual(r.valor, {
      p_modo: "entrega", p_nome: "Maria da Silva", p_telefone: "5511980000001",
      p_endereco: "Rua das Flores, 100", p_pagamento: "pix", p_troco: null, p_observacoes: "sem cebola",
    });
  });
  test("retirada não manda endereço", () => {
    const r = validarPedido({ ...bom, modo: "retirada" }, loja);
    assert.equal(r.valor.p_endereco, null);
  });
  const casos = [
    ["sem modo", { modo: "" }, /entrega ou retirada/],
    ["nome curto", { nome: "A" }, /pelo menos 2 letras/],
    ["nome longo", { nome: "x".repeat(61) }, /no máximo 60/],
    ["sem telefone", { telefone: "abc" }, /telefone com DDD/],
    ["telefone curto", { telefone: "123" }, /Telefone inválido/],
    ["DDD impossível", { telefone: "10 98000-0001" }, /Telefone inválido/],
    ["entrega sem endereço", { endereco: "" }, /endereço completo/],
    ["endereço curto", { endereco: "Rua" }, /endereço completo/],
    ["endereço longo", { endereco: "R".repeat(201) }, /no máximo 200/],
    ["pagamento que a loja não aceita", { pagamento: "cartao" }, /Escolha como vai pagar/],
    ["sem pagamento", { pagamento: "" }, /Escolha como vai pagar/],
    ["observações longas", { observacoes: "o".repeat(301) }, /no máximo 300/],
  ];
  for (const [nome, extra, texto] of casos) test(nome, () => assert.match(erro(validarPedido({ ...bom, ...extra }, loja)), texto));

  test("loja só de retirada recusa entrega, e a de entrega recusa retirada", () => {
    assert.match(erro(validarPedido(bom, { ...loja, modoAtendimento: "retirada" })), /só atende por retirada/);
    assert.match(erro(validarPedido({ ...bom, modo: "retirada" }, { ...loja, modoAtendimento: "entrega" })), /só atende por entrega/);
  });
  test("troco: vazio é permitido; precisa cobrir o total", () => {
    assert.equal(validarPedido({ ...bom, pagamento: "dinheiro", troco: "" }, loja).valor.p_troco, null);
    assert.equal(validarPedido({ ...bom, pagamento: "dinheiro", troco: "50" }, loja).valor.p_troco, 50);
    assert.equal(validarPedido({ ...bom, pagamento: "dinheiro", troco: "R$ 50,00" }, loja).valor.p_troco, 50);
    assert.match(erro(validarPedido({ ...bom, pagamento: "dinheiro", troco: "20" }, loja)), /igual ou maior que o total/);
    assert.match(erro(validarPedido({ ...bom, pagamento: "dinheiro", troco: "abc" }, loja)), /valor do troco/);
    assert.match(erro(validarPedido({ ...bom, pagamento: "dinheiro", troco: "0" }, loja)), /valor do troco/);
    assert.match(erro(validarPedido({ ...bom, pagamento: "dinheiro", troco: "20000" }, loja)), /alto demais/);
  });
  test("troco digitado com outro meio de pagamento é ignorado", () => {
    assert.equal(validarPedido({ ...bom, pagamento: "pix", troco: "50" }, loja).valor.p_troco, null);
  });
  test("entradas hostis não quebram: viram erro ou texto limpo", () => {
    const hostil = ["' or 1=1 --", "<script>alert(1)</script>", "💥".repeat(40), "\u0000\u0007", "a".repeat(100000)];
    for (const h of hostil) {
      const r = validarPedido({ modo: h, nome: h, telefone: h, endereco: h, pagamento: h, troco: h, observacoes: h }, loja);
      assert.equal(r.ok, false);
    }
  });
});

describe("validarConfigPedidos", () => {
  test("liga e desliga, com meios de pagamento e taxa", () => {
    assert.deepEqual(validarConfigPedidos({ aceita: true, pagamentos: ["pix", "cartao"], taxa: "5,50" }), {
      ok: true,
      valor: { aceita_pedidos: true, pagamentos_aceitos: ["pix", "cartao"], taxa_entrega: 5.5 },
    });
    assert.equal(validarConfigPedidos({ aceita: false, pagamentos: ["pix"], taxa: "" }).valor.taxa_entrega, 0);
  });
  test("pelo menos um meio de pagamento; valor fora da lista é ignorado", () => {
    assert.match(validarConfigPedidos({ aceita: true, pagamentos: [], taxa: "" }).erro, /pelo menos um meio de pagamento/);
    assert.match(validarConfigPedidos({ aceita: true, pagamentos: ["bitcoin"], taxa: "" }).erro, /pelo menos um meio de pagamento/);
    assert.deepEqual(validarConfigPedidos({ aceita: true, pagamentos: ["pix", "bitcoin"], taxa: "" }).valor.pagamentos_aceitos, ["pix"]);
  });
  test("taxa inválida, negativa ou acima de R$ 999", () => {
    for (const taxa of ["abc", "-5", "1000", "5,555", "R$"]) {
      assert.match(validarConfigPedidos({ aceita: true, pagamentos: ["pix"], taxa }).erro, /Taxa de entrega inválida/, taxa);
    }
    assert.equal(validarConfigPedidos({ aceita: true, pagamentos: ["pix"], taxa: "999" }).ok, true);
  });
});
