// Links de divulgação do perfil e mensagem do vendedor (sem banco, sem rede).

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { linkDoPerfil, linkFacebook, linkWhatsApp, mensagemPadrao, ORIGENS, origemValida } from "../../src/lib/compartilhar.ts";
import { validarMensagemCompartilhar } from "../../src/lib/validacao.ts";

const ID = "774545e3-d167-4fb0-9679-dfa0e2c6f150";

describe("origemValida", () => {
  test("aceita só as origens conhecidas", () => {
    for (const o of ORIGENS) assert.equal(origemValida(o), o);
  });

  test("o resto vira nulo, inclusive entradas hostis", () => {
    for (const o of [null, undefined, "", "WhatsApp", "twitter", "whatsapp ", "whatsapp\n", "' or 1=1 --", "<script>", "__proto__", "💥", "a".repeat(10000)]) {
      assert.equal(origemValida(o), null, JSON.stringify(String(o).slice(0, 20)));
    }
  });
});

describe("linkDoPerfil", () => {
  test("monta o endereço do perfil com a origem", () => {
    assert.equal(linkDoPerfil("https://saborlocal.com.br", ID, "whatsapp"), `https://saborlocal.com.br/vendedores/${ID}?origem=whatsapp`);
  });

  test("sem origem, o link é o do perfil puro", () => {
    assert.equal(linkDoPerfil("https://saborlocal.com.br", ID), `https://saborlocal.com.br/vendedores/${ID}`);
    assert.equal(linkDoPerfil("https://saborlocal.com.br", ID, null), `https://saborlocal.com.br/vendedores/${ID}`);
  });

  test("barras sobrando no fim do endereço do site não duplicam", () => {
    assert.equal(linkDoPerfil("https://x.com///", ID, "qr"), `https://x.com/vendedores/${ID}?origem=qr`);
  });
});

describe("linkWhatsApp e linkFacebook", () => {
  const url = linkDoPerfil("https://saborlocal.com.br", ID, "whatsapp");

  test("o WhatsApp leva mensagem e link, com acentos e símbolos codificados", () => {
    const l = new URL(linkWhatsApp("Peça na Zé & Cia! Cardápio:", url));
    assert.equal(l.origin + l.pathname, "https://wa.me/");
    assert.equal(l.searchParams.get("text"), `Peça na Zé & Cia! Cardápio: ${url}`);
  });

  test("não deixa a mensagem trocar o destino nem criar parâmetros", () => {
    const l = new URL(linkWhatsApp("oi&phone=5511999999999#x", url));
    assert.equal(l.searchParams.get("phone"), null);
    assert.equal(l.hash, "");
  });

  test("o Facebook recebe o link codificado", () => {
    const l = new URL(linkFacebook(url));
    assert.equal(l.origin + l.pathname, "https://www.facebook.com/sharer/sharer.php");
    assert.equal(l.searchParams.get("u"), url);
  });
});

describe("mensagemPadrao", () => {
  test("cita o nome do negócio", () => assert.match(mensagemPadrao("Pizzaria do Zé"), /Pizzaria do Zé/));
});

describe("validarMensagemCompartilhar", () => {
  test("aceita e limpa espaços e quebras de linha", () => {
    assert.deepEqual(validarMensagemCompartilhar("  Peça\n\nna   Pizzaria!  "), { ok: true, valor: "Peça na Pizzaria!" });
  });

  test("recusa mensagem curta e vazia", () => {
    for (const t of ["", "   ", "oi", "\n\n\n"]) {
      const r = validarMensagemCompartilhar(t);
      assert.equal(r.ok, false, JSON.stringify(t));
      assert.match(r.erro, /pelo menos 5 caracteres/);
    }
  });

  test("recusa mensagem acima de 200 caracteres e diz quantos tem", () => {
    const r = validarMensagemCompartilhar("a".repeat(201));
    assert.match(r.erro, /no máximo 200 caracteres \(agora tem 201\)/);
    assert.equal(validarMensagemCompartilhar("a".repeat(200)).ok, true);
  });

  test("remove caracteres de controle e não derruba com entradas estranhas", () => {
    assert.equal(validarMensagemCompartilhar("Olá\u0000\u0007 mundo!").valor, "Olá mundo!");
    for (const e of ["💥".repeat(5000), "\0".repeat(100), "a\r\nb\tc".repeat(100)]) {
      assert.doesNotThrow(() => validarMensagemCompartilhar(e));
    }
  });
});
