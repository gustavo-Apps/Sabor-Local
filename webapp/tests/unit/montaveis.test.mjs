// "Monte o seu" (pizza, açaí...): regras de tamanho, escolhas, adicionais, chave do carrinho e conferência (sem rede, sem banco).

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  CHAVE_DE_MONTAGEM,
  chaveDaMontagem,
  detalhesDaMontagem,
  itensSoDeEscolha,
  lerChaveDaMontagem,
  linhasMontadas,
  mensagemDaMontagem,
  menorPreco,
  montagemParaEnviar,
  montarMontaveis,
  montaveisDisponiveis,
  nomeDaMontagem,
  precoDaMontagem,
  problemaDaMontagem,
  tamanhosMontaveis,
  textoDosDetalhes,
} from "../../src/lib/montaveis.ts";
import { definirQuantidade, lerCarrinho } from "../../src/lib/carrinho.ts";
import { calcularTotais, montarResumoParaWhatsApp, mensagemErroDoPedido } from "../../src/lib/pedidos.ts";
import { validarAdicional, validarAjustesDoMontavel, validarMontavelNovo, validarTamanho } from "../../src/lib/validacao.ts";

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const PIZZA = id(1);
const MEDIA = id(11);
const GRANDE = id(12);
const BROTO = id(13);
const CALABRESA = id(21);
const FRANGO = id(22);
const MUSSARELA = id(23);
const BRIGADEIRO = id(24);
const BORDA = id(31);
const BACON = id(32);

const pizza = () => ({
  id: PIZZA,
  nome: "Pizza",
  descricao: null,
  rotuloEscolhas: "Sabores",
  escolhaObrigatoria: true,
  rotuloAdicionais: "Adicionais",
  maxAdicionais: 2,
  tamanhos: [
    { id: MEDIA, nome: "Média (30 cm)", preco: 54, maxEscolhas: 2 },
    { id: GRANDE, nome: "Grande (35 cm)", preco: 62, maxEscolhas: 3 },
    { id: BROTO, nome: "Broto", preco: 30, maxEscolhas: 0 },
  ],
  escolhas: [
    { id: CALABRESA, nome: "Calabresa" },
    { id: FRANGO, nome: "Frango com catupiry" },
    { id: MUSSARELA, nome: "Mussarela" },
    { id: BRIGADEIRO, nome: "Brigadeiro" },
  ],
  adicionais: [
    { id: BORDA, nome: "Borda recheada", preco: 10 },
    { id: BACON, nome: "Bacon", preco: 3 },
  ],
});
const m = (extra = {}) => ({ montavelId: PIZZA, tamanhoId: MEDIA, escolhas: [CALABRESA, FRANGO], adicionais: [], ...extra });

describe("o preço é o do tamanho", () => {
  test("não muda com os sabores", () => {
    const p = pizza();
    assert.equal(precoDaMontagem(p, m({ escolhas: [CALABRESA, FRANGO] })), 54);
    assert.equal(precoDaMontagem(p, m({ escolhas: [CALABRESA, BRIGADEIRO] })), 54);
    assert.equal(precoDaMontagem(p, m({ escolhas: [MUSSARELA] })), 54);
    assert.equal(precoDaMontagem(p, m({ tamanhoId: GRANDE, escolhas: [CALABRESA, FRANGO, MUSSARELA] })), 62);
  });
  test("adicionais somam", () => {
    const p = pizza();
    assert.equal(precoDaMontagem(p, m({ adicionais: [BORDA] })), 64);
    assert.equal(precoDaMontagem(p, m({ adicionais: [BORDA, BACON] })), 67);
  });
  test("centavos não acumulam erro de ponto flutuante", () => {
    const p = pizza();
    p.tamanhos[0].preco = 10.1;
    p.adicionais[0].preco = 0.2;
    p.adicionais[1].preco = 0.1;
    assert.equal(precoDaMontagem(p, m({ adicionais: [BORDA, BACON] })), 10.4);
  });
  test("tamanho que não existe custa zero (e a conferência barra antes)", () => {
    assert.equal(precoDaMontagem(pizza(), m({ tamanhoId: id(99) })), 0);
  });
  test("nome do pedido e menor preço", () => {
    assert.equal(nomeDaMontagem(pizza(), m()), "Pizza Média (30 cm)");
    assert.equal(menorPreco(pizza()), 30);
  });
});

describe("conferência (problemaDaMontagem)", () => {
  const p = pizza();
  test("montagem certa não tem problema", () => {
    assert.equal(problemaDaMontagem(p, m()), null);
    assert.equal(problemaDaMontagem(p, m({ escolhas: [CALABRESA] })), null);
    assert.equal(problemaDaMontagem(p, m({ tamanhoId: BROTO, escolhas: [] })), null);
    assert.equal(problemaDaMontagem(p, m({ adicionais: [BORDA, BACON] })), null);
  });
  test("sem tamanho", () => {
    assert.match(problemaDaMontagem(p, m({ tamanhoId: "" })), /tamanho/);
    assert.match(problemaDaMontagem(p, m({ tamanhoId: id(99) })), /tamanho/);
  });
  test("mais sabores que o tamanho aceita diz quantos tirar", () => {
    assert.match(problemaDaMontagem(p, m({ escolhas: [CALABRESA, FRANGO, MUSSARELA] })), /até 2 sabores\. Tire 1\./);
    assert.match(problemaDaMontagem(p, m({ tamanhoId: GRANDE, escolhas: [CALABRESA, FRANGO, MUSSARELA, BRIGADEIRO] })), /até 3 sabores\. Tire 1\./);
    assert.match(problemaDaMontagem(p, m({ tamanhoId: BROTO, escolhas: [CALABRESA] })), /não inclui sabores/);
  });
  test("escolha obrigatória: pelo menos 1, só nos tamanhos que incluem", () => {
    assert.match(problemaDaMontagem(p, m({ escolhas: [] })), /pelo menos 1/);
    assert.equal(problemaDaMontagem(p, m({ tamanhoId: BROTO, escolhas: [] })), null);
    p.escolhaObrigatoria = false;
    assert.equal(problemaDaMontagem(p, m({ escolhas: [] })), null);
    p.escolhaObrigatoria = true;
  });
  test("adicionais acima do máximo", () => {
    const q = pizza();
    q.maxAdicionais = 1;
    assert.match(problemaDaMontagem(q, m({ adicionais: [BORDA, BACON] })), /até 1 adicionais/);
    q.maxAdicionais = 0;
    assert.match(problemaDaMontagem(q, m({ adicionais: [BACON] })), /até 0/);
  });
  test("opção que não existe mais ou repetida", () => {
    assert.match(problemaDaMontagem(p, m({ escolhas: [id(98)] })), /não está mais disponível/);
    assert.match(problemaDaMontagem(p, m({ adicionais: [id(97)] })), /não está mais disponível/);
    assert.match(problemaDaMontagem(p, m({ escolhas: [CALABRESA, CALABRESA] })), /repetida/);
  });
});

describe("tamanhos que dá para montar", () => {
  test("sem nenhum sabor disponível, só os tamanhos sem escolha (ou nenhum)", () => {
    const p = pizza();
    p.escolhas = [];
    assert.deepEqual(tamanhosMontaveis(p).map((t) => t.id), [BROTO]);
    assert.equal(menorPreco(p), 30);
    p.tamanhos = p.tamanhos.slice(0, 2);
    assert.deepEqual(tamanhosMontaveis(p), []);
    assert.equal(menorPreco(p), null);
    assert.deepEqual(montaveisDisponiveis([p]), []);
  });
  test("escolha opcional deixa montar sem sabores disponíveis", () => {
    const p = pizza();
    p.escolhas = [];
    p.escolhaObrigatoria = false;
    assert.equal(tamanhosMontaveis(p).length, 3);
  });
});

describe("chave do carrinho", () => {
  test("ida e volta, com os ids em ordem (clicar em outra ordem dá a mesma chave)", () => {
    const a = chaveDaMontagem(m({ escolhas: [FRANGO, CALABRESA], adicionais: [BORDA, BACON] }));
    const b = chaveDaMontagem(m({ escolhas: [CALABRESA, FRANGO], adicionais: [BACON, BORDA] }));
    assert.equal(a, b);
    assert.deepEqual(lerChaveDaMontagem(a), { montavelId: PIZZA, tamanhoId: MEDIA, escolhas: [CALABRESA, FRANGO], adicionais: [BORDA, BACON] });
  });
  test("sem escolhas nem adicionais", () => {
    const k = chaveDaMontagem(m({ escolhas: [], adicionais: [] }));
    assert.deepEqual(lerChaveDaMontagem(k), { montavelId: PIZZA, tamanhoId: MEDIA, escolhas: [], adicionais: [] });
  });
  test("montagens diferentes têm chaves diferentes", () => {
    assert.notEqual(chaveDaMontagem(m()), chaveDaMontagem(m({ escolhas: [CALABRESA] })));
    assert.notEqual(chaveDaMontagem(m()), chaveDaMontagem(m({ tamanhoId: GRANDE })));
    assert.notEqual(chaveDaMontagem(m()), chaveDaMontagem(m({ adicionais: [BACON] })));
  });
  test("chave quebrada é recusada", () => {
    for (const k of ["", "m|x|y||", `m|${PIZZA}|${MEDIA}|${CALABRESA}`, `x|${PIZZA}|${MEDIA}||`, `m|${PIZZA}|${MEDIA}|lixo|`, id(1), `m|${PIZZA}|${MEDIA}|${CALABRESA},|`]) {
      assert.equal(lerChaveDaMontagem(k), null, k);
    }
  });
  test("o carrinho (carrinho.ts) e a montagem (montaveis.ts) concordam sobre o que é uma chave válida", () => {
    const boas = [chaveDaMontagem(m()), chaveDaMontagem(m({ escolhas: [], adicionais: [BACON] })), chaveDaMontagem(m({ adicionais: [BORDA, BACON] }))];
    const ruins = ["m|x|y||", `m|${PIZZA}|${MEDIA}|${CALABRESA}`, `m|${PIZZA}|${MEDIA}|a|b`, `m|${PIZZA}|${MEDIA}||${CALABRESA},`];
    for (const k of boas) {
      assert.ok(CHAVE_DE_MONTAGEM.test(k));
      assert.deepEqual(lerCarrinho(JSON.stringify({ [k]: 2 })), { [k]: 2 }, k);
    }
    for (const k of ruins) {
      assert.ok(!CHAVE_DE_MONTAGEM.test(k));
      assert.deepEqual(lerCarrinho(JSON.stringify({ [k]: 2 })), {}, k);
    }
  });
  test("o carrinho guarda montagens como linhas próprias e soma as iguais", () => {
    const k1 = chaveDaMontagem(m());
    const k2 = chaveDaMontagem(m({ tamanhoId: GRANDE }));
    let c = definirQuantidade({}, k1, 1);
    c = definirQuantidade(c, k2, 1);
    c = definirQuantidade(c, k1, c[k1] + 1);
    assert.deepEqual(c, { [k1]: 2, [k2]: 1 });
    assert.deepEqual(definirQuantidade(c, k1, 0), { [k2]: 1 });
  });
  test("ids em maiúsculas também valem", () => {
    const k = chaveDaMontagem(m()).toUpperCase().replace(/^M/, "m");
    assert.ok(lerChaveDaMontagem(k));
  });
});

describe("linhas do carrinho", () => {
  const p = pizza();
  test("traz nome, preço, quantidade e detalhes; descarta o que deixou de valer", () => {
    const boa = chaveDaMontagem(m({ adicionais: [BORDA] }));
    const semSabor = chaveDaMontagem(m({ escolhas: [id(98)] })); // sabor que saiu do cardápio
    const outraLoja = chaveDaMontagem({ ...m(), montavelId: id(2) });
    const linhas = linhasMontadas({ [boa]: 2, [semSabor]: 1, [outraLoja]: 1, [id(5)]: 3 }, [p]);
    assert.equal(linhas.length, 1);
    const l = linhas[0];
    assert.equal(l.nome, "Pizza Média (30 cm)");
    assert.equal(l.preco, 64);
    assert.equal(l.quantidade, 2);
    assert.deepEqual(l.detalhes, [
      { rotulo: "Sabores", opcoes: [{ nome: "Calabresa" }, { nome: "Frango com catupiry" }] },
      { rotulo: "Adicionais", opcoes: [{ nome: "Borda recheada", preco: 10 }] },
    ]);
  });
  test("a ordem dos detalhes é a do cardápio, não a do clique", () => {
    const k = chaveDaMontagem(m({ escolhas: [FRANGO, CALABRESA] }));
    const [l] = linhasMontadas({ [k]: 1 }, [p]);
    assert.deepEqual(l.detalhes[0].opcoes.map((o) => o.nome), ["Calabresa", "Frango com catupiry"]);
  });
  test("pizza montada com tamanho que deixou de existir sai do pedido", () => {
    const q = pizza();
    q.tamanhos = q.tamanhos.filter((t) => t.id !== MEDIA);
    assert.deepEqual(linhasMontadas({ [chaveDaMontagem(m())]: 1 }, [q]), []);
  });
  test("o que vai para o banco são só ids e quantidade", () => {
    const [l] = linhasMontadas({ [chaveDaMontagem(m({ adicionais: [BACON] }))]: 3 }, [p]);
    assert.deepEqual(montagemParaEnviar(l), { montavel_id: PIZZA, tamanho_id: MEDIA, escolhas: [CALABRESA, FRANGO], adicionais: [BACON], quantidade: 3 });
    assert.ok(!("preco" in montagemParaEnviar(l)));
  });
  test("entra no total do pedido junto com a taxa", () => {
    const [l] = linhasMontadas({ [chaveDaMontagem(m({ adicionais: [BORDA] }))]: 2 }, [p]);
    assert.deepEqual(calcularTotais([l], "entrega", 5), { quantidade: 2, subtotal: 128, taxaEntrega: 5, total: 133, sobConsulta: false });
  });
});

describe("texto dos detalhes", () => {
  test("uma linha por grupo; adicional pago mostra o valor", () => {
    const grupos = detalhesDaMontagem(pizza(), m({ adicionais: [BORDA, BACON] }));
    const linhas = textoDosDetalhes(grupos);
    assert.equal(linhas[0], "Sabores: Calabresa, Frango com catupiry");
    assert.match(linhas[1], /^Adicionais: Borda recheada \(\+R\$\s?10,00\), Bacon \(\+R\$\s?3,00\)$/);
  });
  test("sem detalhes, sem linhas (e dados estranhos do banco não quebram)", () => {
    assert.deepEqual(textoDosDetalhes([]), []);
    assert.deepEqual(textoDosDetalhes(null), []);
    assert.deepEqual(textoDosDetalhes(undefined), []);
    assert.deepEqual(textoDosDetalhes([{ rotulo: "X", opcoes: [] }, null, { rotulo: "Y" }]), []);
  });
  test("adicional grátis não mostra '+R$ 0,00'", () => {
    assert.equal(textoDosDetalhes([{ rotulo: "Adicionais", opcoes: [{ nome: "Guardanapo", preco: 0 }] }])[0], "Adicionais: Guardanapo");
  });
  test("mensagem do WhatsApp da loja sem pedido pelo site", () => {
    const t = mensagemDaMontagem(pizza(), m({ adicionais: [BACON] }));
    assert.match(t, /^Pizza Média \(30 cm\) \(R\$\s?57,00\)\n/);
    assert.ok(t.includes("Sabores: Calabresa, Frango com catupiry"));
    assert.ok(t.includes("Bacon"));
  });
  test("o resumo do pedido leva as escolhas logo abaixo do item", () => {
    const texto = montarResumoParaWhatsApp("Pizzaria", {
      numero: 3,
      nome: "Ana",
      modo: "retirada",
      endereco: null,
      pagamento: "pix",
      troco: null,
      observacoes: null,
      linhas: [{ nome: "Pizza Média (30 cm)", preco: 54, quantidade: 1, detalhesEmTexto: ["Sabores: Calabresa, Frango"] }],
      totais: { quantidade: 1, subtotal: 54, taxaEntrega: 0, total: 54, sobConsulta: false },
    });
    const linhas = texto.split("\n");
    const i = linhas.findIndex((l) => l.includes("1x Pizza Média (30 cm)"));
    assert.ok(i >= 0);
    assert.equal(linhas[i + 1].trim(), "Sabores: Calabresa, Frango");
  });
  test("as mensagens de erro do pedido cobrem as montagens", () => {
    assert.match(mensagemErroDoPedido("montagem_indisponivel"), /monte de novo/);
    assert.match(mensagemErroDoPedido("montagem_invalida"), /monte de novo/);
  });
});

describe("do banco para a tela (montarMontaveis)", () => {
  const bruto = () => ({
    id: PIZZA,
    nome: "Pizza",
    descricao: "Massa fina",
    rotulo_escolhas: "Sabores",
    escolha_obrigatoria: true,
    rotulo_adicionais: "Adicionais",
    max_adicionais: 3,
    disponivel: true,
    ordem: 1,
    tamanhos: [
      { id: GRANDE, nome: "Grande", preco: "62.00", max_escolhas: 3, ordem: 2 },
      { id: MEDIA, nome: "Média", preco: 54, max_escolhas: 2, ordem: 1 },
    ],
    adicionais: [
      { id: BORDA, nome: "Borda", preco: "10.00", disponivel: true, ordem: 1 },
      { id: BACON, nome: "Bacon", preco: 3, disponivel: false, ordem: 2 },
    ],
    categorias: [{ categoria_produto_id: id(41) }],
  });
  const itens = [
    { id: CALABRESA, nome: "Calabresa", descricao: "com cebola", foto_url: null, ordem: 2, categoria_produto_id: id(41), disponivel: true },
    { id: FRANGO, nome: "Frango", descricao: null, foto_url: null, ordem: 1, categoria_produto_id: id(41), disponivel: true },
    { id: MUSSARELA, nome: "Mussarela", descricao: null, foto_url: null, ordem: 3, categoria_produto_id: id(41), disponivel: false },
    { id: BRIGADEIRO, nome: "Brigadeiro", descricao: null, foto_url: null, ordem: 4, categoria_produto_id: id(42), disponivel: true },
    { id: id(25), nome: "Sem categoria", descricao: null, foto_url: null, ordem: 5, categoria_produto_id: null, disponivel: true },
  ];

  test("tamanhos em ordem e com número de verdade; só as escolhas disponíveis das categorias marcadas, na ordem do menu", () => {
    const [p] = montarMontaveis([bruto()], itens);
    assert.deepEqual(p.tamanhos.map((t) => [t.nome, t.preco, t.maxEscolhas]), [["Média", 54, 2], ["Grande", 62, 3]]);
    assert.deepEqual(p.escolhas.map((e) => e.nome), ["Frango", "Calabresa"]);
    assert.deepEqual(p.adicionais.map((a) => [a.nome, a.preco]), [["Borda", 10]], "adicional em falta não aparece");
    assert.equal(p.maxAdicionais, 3);
    assert.equal(p.rotuloEscolhas, "Sabores");
  });
  test("produto pausado ou sem tamanhos não aparece; ordem dos produtos", () => {
    const pausado = { ...bruto(), disponivel: false };
    const vazio = { ...bruto(), id: id(2), tamanhos: [] };
    const outro = { ...bruto(), id: id(3), nome: "Açaí", ordem: 0 };
    const lista = montarMontaveis([pausado, vazio, bruto(), outro], itens);
    assert.deepEqual(lista.map((x) => x.nome), ["Açaí", "Pizza"]);
  });
  test("itens sem preço nas categorias dos produtos são 'só escolha' (não se pedem sozinhos)", () => {
    const comPreco = [
      { id: CALABRESA, preco: null, categoria_produto_id: id(41) },
      { id: FRANGO, preco: 12, categoria_produto_id: id(41) },
      { id: BRIGADEIRO, preco: null, categoria_produto_id: id(42) },
      { id: id(25), preco: null, categoria_produto_id: null },
    ];
    assert.deepEqual([...itensSoDeEscolha([bruto()], comPreco)], [CALABRESA]);
    assert.equal(itensSoDeEscolha([], comPreco).size, 0);
  });
});

describe("validação do cadastro", () => {
  test("novo produto", () => {
    assert.deepEqual(validarMontavelNovo({ nome: "  Pizza  ", rotuloEscolhas: "" }), { ok: true, valor: { nome: "Pizza", rotulo_escolhas: "Sabores" } });
    assert.deepEqual(validarMontavelNovo({ nome: "Açaí", rotuloEscolhas: "Acompanhamentos" }).valor, { nome: "Açaí", rotulo_escolhas: "Acompanhamentos" });
    for (const nome of ["", "A", "x".repeat(41), "!!!", "www.golpe.com", "ana@x.com"]) assert.equal(validarMontavelNovo({ nome, rotuloEscolhas: "Sabores" }).ok, false, nome);
    assert.equal(validarMontavelNovo({ nome: "Pizza", rotuloEscolhas: "x".repeat(31) }).ok, false);
  });
  test("ajustes", () => {
    const base = { nome: "Pizza", descricao: "", rotuloEscolhas: "Sabores", rotuloAdicionais: "Adicionais", maxAdicionais: "", escolhaObrigatoria: true };
    assert.deepEqual(validarAjustesDoMontavel(base).valor, {
      nome: "Pizza", rotulo_escolhas: "Sabores", descricao: null, rotulo_adicionais: "Adicionais", max_adicionais: 5, escolha_obrigatoria: true,
    });
    assert.equal(validarAjustesDoMontavel({ ...base, maxAdicionais: "0" }).valor.max_adicionais, 0);
    assert.equal(validarAjustesDoMontavel({ ...base, escolhaObrigatoria: false }).valor.escolha_obrigatoria, false);
    for (const maxAdicionais of ["21", "-1", "1.5", "muitos"]) assert.equal(validarAjustesDoMontavel({ ...base, maxAdicionais }).ok, false, maxAdicionais);
    assert.equal(validarAjustesDoMontavel({ ...base, descricao: "x".repeat(201) }).ok, false);
    assert.equal(validarAjustesDoMontavel({ ...base, descricao: "veja www.loja.com" }).ok, false);
  });
  test("tamanho", () => {
    assert.deepEqual(validarTamanho({ nome: "Média (30 cm)", preco: "54,00", maxEscolhas: "2" }).valor, { nome: "Média (30 cm)", preco: 54, max_escolhas: 2 });
    assert.deepEqual(validarTamanho({ nome: "G", preco: "R$ 1.250,50", maxEscolhas: "" }).valor, { nome: "G", preco: 1250.5, max_escolhas: 1 });
    assert.equal(validarTamanho({ nome: "Broto", preco: "30", maxEscolhas: "0" }).valor.max_escolhas, 0);
    for (const preco of ["", "0", "-5", "abc", "2000,01", "10,999"]) assert.equal(validarTamanho({ nome: "G", preco, maxEscolhas: "1" }).ok, false, preco);
    for (const maxEscolhas of ["11", "-1", "1,5", "dois"]) assert.equal(validarTamanho({ nome: "G", preco: "10", maxEscolhas }).ok, false, maxEscolhas);
    assert.equal(validarTamanho({ nome: "", preco: "10", maxEscolhas: "1" }).ok, false);
  });
  test("adicional: preço vazio = sem custo", () => {
    assert.deepEqual(validarAdicional({ nome: "Granola", preco: "" }).valor, { nome: "Granola", preco: 0 });
    assert.deepEqual(validarAdicional({ nome: "Bacon", preco: "3,50" }).valor, { nome: "Bacon", preco: 3.5 });
    for (const preco of ["501", "-1", "abc"]) assert.equal(validarAdicional({ nome: "Bacon", preco }).ok, false, preco);
    assert.equal(validarAdicional({ nome: "", preco: "1" }).ok, false);
    assert.equal(validarAdicional({ nome: "x@y.com", preco: "1" }).ok, false);
  });
  test("texto hostil vira texto limpo ou erro, sem quebrar", () => {
    assert.equal(validarMontavelNovo({ nome: "Pi\u0000zza", rotuloEscolhas: "Sabores" }).valor.nome, "Pi zza");
    for (const h of ["' or 1=1 --", "<script>", "🍕".repeat(30), "a".repeat(100000)]) assert.doesNotThrow(() => validarTamanho({ nome: h, preco: h, maxEscolhas: h }));
  });
});
