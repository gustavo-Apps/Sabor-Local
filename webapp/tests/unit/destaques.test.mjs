// Itens em destaque: escolha da casa x "mais pedido" (por dados), item indisponível sem selo (sem banco, sem rede).

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { montarDestaques, motivosDoItem, selosDoItem } from "../../src/lib/destaques.ts";
import { buildWhatsAppLink } from "../../src/lib/whatsapp.ts";
import { disponibilidadeDoItem } from "../../src/lib/itens.ts";

const HOJE = "2031-10-06";
const livre = (i) => disponibilidadeDoItem(i, HOJE) === "disponivel";
const motivos = (i, mais) => motivosDoItem(i, mais, livre(i));
const item = (id, extra = {}) => ({ id, nome: id, ordem: Number(id.replace(/\D/g, "")) || 0, ...extra });

describe("motivosDoItem", () => {
  test("escolha da casa", () => assert.deepEqual(motivos(item("i1", { destaque: true }), []), ["casa"]));
  test("mais pedido (vem dos dados)", () => assert.deepEqual(motivos(item("i1"), ["i1"]), ["pedido"]));
  test("os dois motivos juntos", () => assert.deepEqual(motivos(item("i1", { destaque: true }), ["i1"]), ["casa", "pedido"]));
  test("sem nenhum, sem selo", () => assert.deepEqual(motivos(item("i1"), ["i2"]), []));
  test("indisponível não ganha selo, nem escolhido nem mais pedido", () => {
    const parado = item("i1", { destaque: true, disponivel: false, indisponivel_ate: null });
    assert.deepEqual(motivos(parado, ["i1"]), []);
    const hoje = item("i2", { destaque: true, disponivel: false, indisponivel_ate: HOJE });
    assert.deepEqual(motivos(hoje, ["i2"]), []);
  });
  test("volta a ter selo quando o item volta a ficar disponível", () => {
    const voltou = item("i1", { destaque: true, disponivel: false, indisponivel_ate: "2031-10-05" });
    assert.deepEqual(motivos(voltou, []), ["casa"]);
  });
});

describe("montarDestaques", () => {
  const itens = [
    item("i1"),
    item("i2", { destaque: true }),
    item("i3"),
    item("i4", { destaque: true }),
    item("i5"),
    item("i6"),
    item("i7"),
  ];

  test("primeiro as escolhas da casa, depois os mais pedidos na ordem do ranking", () => {
    const r = montarDestaques(itens, ["i6", "i1"], livre);
    assert.deepEqual(r.map((d) => d.item.id), ["i2", "i4", "i6", "i1"]);
  });
  test("item escolhido pela casa e também mais pedido aparece uma vez, com os dois selos", () => {
    const r = montarDestaques(itens, ["i2", "i3"], livre);
    assert.deepEqual(r.map((d) => d.item.id), ["i2", "i4", "i3"]);
    assert.deepEqual(r[0].motivos, ["casa", "pedido"]);
  });
  test("no máximo 5 itens", () => {
    const muitos = Array.from({ length: 9 }, (_, n) => item(`i${n + 1}`));
    assert.equal(montarDestaques(muitos, muitos.map((i) => i.id), livre).length, 5);
  });
  test("ignora os indisponíveis e ids de itens que não existem mais", () => {
    const base = [item("i1", { destaque: true, disponivel: false, indisponivel_ate: null }), item("i2")];
    assert.deepEqual(montarDestaques(base, ["i1", "i2", "apagado"], livre).map((d) => d.item.id), ["i2"]);
  });
  test("sem escolha e sem dados, a seção fica vazia (não inventa destaque)", () => {
    assert.deepEqual(montarDestaques(itens.map((i) => ({ ...i, destaque: false })), [], livre), []);
  });
});

describe("selosDoItem", () => {
  test("a escolha da casa e o dado têm nomes diferentes (nunca 'mais vendido')", () => {
    assert.deepEqual(selosDoItem(["casa", "pedido"]), ["Destaque da casa", "Mais pedido"]);
    assert.deepEqual(selosDoItem([]), []);
  });
});

describe("mensagem do WhatsApp com o item", () => {
  test("sem item: a mensagem de sempre", () => {
    const url = buildWhatsAppLink("(55) 99999-0000", "Loja X");
    assert.match(decodeURIComponent(url), /gostaria de fazer um pedido\./);
    assert.ok(url.startsWith("https://wa.me/5599999000"));
  });
  test("com item e preço: cita o item e o valor", () => {
    const texto = decodeURIComponent(buildWhatsAppLink("5555999990000", "Loja X", { nome: "Pastel de carne", preco: 8 }));
    assert.match(texto, /gostaria de pedir: Pastel de carne \(R\$\s?8,00\)\./);
  });
  test("item sem preço não mostra parênteses vazios", () => {
    const texto = decodeURIComponent(buildWhatsAppLink("5555999990000", "Loja X", { nome: "Bolo do dia", preco: null }));
    assert.match(texto, /gostaria de pedir: Bolo do dia\./);
  });
  test("nome com & ou # não quebra o link", () => {
    const url = buildWhatsAppLink("5555999990000", "Loja X", { nome: "Pão & Café #1" });
    assert.ok(!url.slice(url.indexOf("text=")).includes("&"));
    assert.match(decodeURIComponent(url), /Pão & Café #1/);
  });
});
