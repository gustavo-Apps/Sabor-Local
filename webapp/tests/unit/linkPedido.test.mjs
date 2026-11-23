// Link de pedidos próprio: validação do endereço e do texto do botão (sem banco, sem rede).

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { ROTULO_PADRAO_LINK_PEDIDO, validarLinkPedido, validarPerfil, validarRotuloLink } from "../../src/lib/validacao.ts";

describe("validarLinkPedido: aceita", () => {
  const aceitos = [
    ["https completo", "https://meusite.com.br/cardapio", "https://meusite.com.br/cardapio"],
    ["sem esquema vira https", "meusite.com.br/cardapio", "https://meusite.com.br/cardapio"],
    ["http simples", "http://meusite.com.br", "http://meusite.com.br/"],
    ["maiúsculas no domínio", "HTTPS://MeuSite.COM.br/Menu", "https://meusite.com.br/Menu"],
    ["espaços nas pontas", "  https://meusite.com.br  ", "https://meusite.com.br/"],
    ["com parâmetros", "https://pedidos.exemplo.com.br/loja?mesa=1&x=2", "https://pedidos.exemplo.com.br/loja?mesa=1&x=2"],
    ["subdomínio e caminho", "https://app.cardapio.web/minha-loja", "https://app.cardapio.web/minha-loja"],
    ["nome com acento vira punycode", "https://padaria-açaí.com.br", "https://xn--padaria-aa-w6a7e.com.br/"],
    ["com âncora", "https://meusite.com.br/menu#bebidas", "https://meusite.com.br/menu#bebidas"],
  ];
  for (const [nome, entrada, esperado] of aceitos) {
    test(nome, () => assert.deepEqual(validarLinkPedido(entrada), { ok: true, valor: esperado }));
  }

  test("vazio ou só espaços significa 'sem link'", () => {
    assert.deepEqual(validarLinkPedido(""), { ok: true, valor: null });
    assert.deepEqual(validarLinkPedido("   "), { ok: true, valor: null });
  });
});

describe("validarLinkPedido: recusa", () => {
  const recusas = [
    ["javascript:", "javascript:alert(1)", /começar com https/],
    ["JavaScript com maiúsculas", "JaVaScRiPt:alert(1)", /começar com https/],
    ["data:", "data:text/html,<script>alert(1)</script>", /começar com https/],
    ["vbscript:", "vbscript:msgbox(1)", /começar com https/],
    ["file:", "file:///etc/passwd", /começar com https/],
    ["ftp:", "ftp://meusite.com.br/arquivo", /começar com https/],
    ["whatsapp:", "whatsapp://send?phone=5511999999999", /começar com https/],
    ["usuário e senha", "https://usuario:senha@meusite.com.br", /usuário e senha/],
    ["só usuário", "https://usuario@meusite.com.br", /usuário e senha/],
    ["IP v4", "http://192.168.0.10/menu", /número de IP/],
    ["IP público", "https://8.8.8.8", /número de IP/],
    ["IP v6", "http://[::1]/", /número de IP/],
    ["localhost", "http://localhost", /endereço público/],
    ["nome sem ponto", "https://intranet/menu", /endereço público/],
    ["domínio interno .local", "https://impressora.local", /endereço público/],
    ["domínio interno .internal", "https://app.internal", /endereço público/],
    ["TLD numérico", "https://site.123", /inválido|endereço público/],
    ["porta", "https://meusite.com.br:8080/menu", /porta/],
    ["espaço no meio", "https://meu site.com.br", /espaços/],
    ["tabulação no meio", "https://meusite.com.br/a\tb", /espaços/],
    ["quebra de linha", "https://meusite.com.br\nBcc: x", /espaços/],
    ["enorme", `https://meusite.com.br/${"a".repeat(300)}`, /no máximo 300/],
    ["lixo", "https://", /inválido/],
    ["só esquema", "https:", /inválido|começar/],
  ];
  for (const [nome, entrada, esperado] of recusas) {
    test(nome, () => {
      const r = validarLinkPedido(entrada);
      assert.equal(r.ok, false, `aceitou: ${entrada}`);
      assert.match(r.erro, esperado);
    });
  }

  test("nenhuma entrada estranha derruba a validação", () => {
    for (const e of ["\0", "💥".repeat(5000), "{}", "null", "//evil.com", "///", "https://.", "https://-.com", "%00", "a".repeat(100000)]) {
      assert.doesNotThrow(() => validarLinkPedido(e), JSON.stringify(e.slice(0, 20)));
    }
  });

  test("o que passa na validação passa no formato do banco (https/http, domínio, sem usuário, até 300)", () => {
    const formatoBanco = /^https?:\/\/[^\s/@?#]+\.[^\s/@?#]+([/?#][^\s]*)?$/i;
    for (const e of ["meusite.com.br", "https://a.co/x?y=1#z", "http://padaria-açaí.com.br/menu", "Pedidos.Exemplo.com/Loja"]) {
      const r = validarLinkPedido(e);
      assert.equal(r.ok, true, e);
      assert.ok(formatoBanco.test(r.valor) && r.valor.length <= 300, r.valor);
    }
  });
});

describe("validarRotuloLink", () => {
  test("aceita texto curto e arruma os espaços", () => {
    assert.deepEqual(validarRotuloLink("  Pedir   no nosso site "), { ok: true, valor: "Pedir no nosso site" });
    assert.deepEqual(validarRotuloLink("a".repeat(30)), { ok: true, valor: "a".repeat(30) });
  });

  test("vazio vira nulo (usa o texto padrão)", () => {
    assert.deepEqual(validarRotuloLink(""), { ok: true, valor: null });
    assert.deepEqual(validarRotuloLink(" \n\t "), { ok: true, valor: null });
    assert.equal(ROTULO_PADRAO_LINK_PEDIDO, "Fazer pedido no site");
  });

  test("recusa mais de 30 caracteres e diz quantos tem", () => {
    assert.match(validarRotuloLink("a".repeat(31)).erro, /no máximo 30 caracteres \(agora tem 31\)/);
  });

  for (const t of ["veja https://x.com", "ifood.com.br/loja", "www.meusite.com", "http://a", "meusite.com"]) {
    test(`recusa endereço dentro do texto: ${t}`, () => assert.match(validarRotuloLink(t).erro, /sem o endereço/));
  }

  test("remove caracteres de controle", () => {
    assert.equal(validarRotuloLink("Pedir\u0000 agora\u0007!").valor, "Pedir agora !");
  });
});

describe("validarPerfil com o link de pedidos", () => {
  const ok = { nome: "Lanchonete", descricao: "", whatsapp: "(11) 99999-0000", modo: "ambos", bairroId: "b1", categoriaIds: ["c1"] };

  test("sem os campos do link, o perfil não mexe neles (compatível com o formato antigo)", () => {
    const r = validarPerfil(ok);
    assert.equal(r.ok, true);
    assert.ok(!("link_pedido_url" in r.valor));
    assert.ok(!("link_pedido_rotulo" in r.valor));
  });

  test("com link: normaliza o endereço e guarda o texto do botão", () => {
    const r = validarPerfil({ ...ok, linkPedido: "meusite.com.br/cardapio", linkRotulo: "Pedir no site" });
    assert.equal(r.valor.link_pedido_url, "https://meusite.com.br/cardapio");
    assert.equal(r.valor.link_pedido_rotulo, "Pedir no site");
  });

  test("apagar o link também apaga o texto do botão (o banco exige as duas coisas juntas)", () => {
    const r = validarPerfil({ ...ok, linkPedido: "", linkRotulo: "Texto solto" });
    assert.equal(r.valor.link_pedido_url, null);
    assert.equal(r.valor.link_pedido_rotulo, null);
  });

  test("link com texto vazio usa o padrão (rótulo nulo)", () => {
    const r = validarPerfil({ ...ok, linkPedido: "meusite.com.br", linkRotulo: "" });
    assert.equal(r.valor.link_pedido_rotulo, null);
  });

  test("link ou texto inválidos impedem salvar o perfil, com a mensagem certa", () => {
    assert.match(validarPerfil({ ...ok, linkPedido: "javascript:alert(1)" }).erro, /https/);
    assert.match(validarPerfil({ ...ok, linkPedido: "meusite.com.br", linkRotulo: "x".repeat(40) }).erro, /30 caracteres/);
  });
});
