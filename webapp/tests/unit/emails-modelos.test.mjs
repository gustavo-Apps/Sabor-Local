// Modelos de e-mail do Supabase (confirmação, recuperação de senha, troca de e-mail): em português, com o link e sem recursos externos.

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const RAIZ = new URL("../../supabase/", import.meta.url);
const ler = (caminho) => readFileSync(new URL(caminho, RAIZ), "utf8");
const config = ler("config.toml");

// secção do config.toml -> arquivo e assunto esperados
const MODELOS = [
  { secao: "confirmation", arquivo: "confirmacao.html", assunto: /Confirme seu e-mail/, usa: ["{{ .ConfirmationURL }}"] },
  { secao: "recovery", arquivo: "recuperacao.html", assunto: /nova senha/, usa: ["{{ .ConfirmationURL }}"] },
  { secao: "email_change", arquivo: "troca-email.html", assunto: /novo e-mail/, usa: ["{{ .ConfirmationURL }}", "{{ .Email }}", "{{ .NewEmail }}"] },
];

function secao(nome) {
  const m = new RegExp(`\\[auth\\.email\\.template\\.${nome}\\]([\\s\\S]*?)(?=\\n\\[|$)`).exec(config);
  assert.ok(m, `config.toml sem [auth.email.template.${nome}]`);
  return m[1];
}

describe("config.toml aponta para os modelos", () => {
  for (const m of MODELOS) {
    test(`${m.secao}: assunto em português e arquivo que existe`, () => {
      const s = secao(m.secao);
      const assunto = /subject\s*=\s*"([^"]+)"/.exec(s)?.[1];
      const caminho = /content_path\s*=\s*"\.\/supabase\/([^"]+)"/.exec(s)?.[1];
      assert.match(assunto ?? "", m.assunto);
      assert.equal(caminho, `templates/${m.arquivo}`);
      assert.ok(existsSync(new URL(caminho, RAIZ)), `arquivo ${caminho} não existe`);
    });
  }

  test("todo arquivo da pasta de modelos está ligado a alguma secção do config.toml", () => {
    const arquivos = readdirSync(new URL("templates/", RAIZ)).filter((f) => f.endsWith(".html"));
    for (const a of arquivos) assert.ok(MODELOS.some((m) => m.arquivo === a), `${a} não está configurado`);
    assert.equal(arquivos.length, MODELOS.length);
  });
});

describe("conteúdo dos modelos", () => {
  for (const m of MODELOS) {
    const html = ler(`templates/${m.arquivo}`);

    test(`${m.arquivo}: HTML completo em português do Brasil`, () => {
      assert.match(html, /^<!doctype html>/i);
      assert.match(html, /<html lang="pt-BR">/);
      assert.match(html, /<meta charset="utf-8"/i);
      assert.match(html, /<meta name="viewport"/);
      assert.match(html, /<title>[^<]+<\/title>/);
    });

    test(`${m.arquivo}: usa as variáveis do Supabase e o link aparece como botão e como texto`, () => {
      for (const v of m.usa) assert.ok(html.includes(v), `faltou ${v}`);
      const ocorrenciasDoLink = html.split("{{ .ConfirmationURL }}").length - 1;
      assert.ok(ocorrenciasDoLink >= 2, "o link deve aparecer no botão e escrito, para quem não consegue clicar");
      assert.match(html, /href="\{\{ \.ConfirmationURL \}\}"/);
    });

    test(`${m.arquivo}: nenhuma palavra em inglês sobrando do modelo original`, () => {
      const visivel = html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");
      for (const palavra of ["Confirm your", "Reset your", "Follow this link", "Click here", "password", "Hello", "Thanks", "Change Email"]) {
        assert.ok(!visivel.includes(palavra), `sobrou: ${palavra}`);
      }
    });

    test(`${m.arquivo}: sem imagem, script nem recurso de fora (alguns leitores bloqueiam e rastreiam)`, () => {
      assert.ok(!/<script/i.test(html));
      assert.ok(!/<img/i.test(html));
      assert.ok(!/<link /i.test(html));
      assert.ok(!/src="https?:/i.test(html));
      assert.ok(!/url\(https?:/i.test(html));
      const enderecos = [...html.matchAll(/https?:\/\/[^\s"'<)]+/g)].map((x) => x[0]);
      assert.deepEqual(enderecos, [], `endereço fixo no modelo: ${enderecos.join(", ")}`);
    });

    test(`${m.arquivo}: estilos dentro das próprias tags (muitos leitores de e-mail ignoram <style>) e tamanho razoável`, () => {
      assert.ok(!/<style/i.test(html));
      assert.ok(/style="[^"]+"/.test(html));
      assert.ok(html.length < 8 * 1024, `${html.length} bytes`);
    });

    test(`${m.arquivo}: avisa que dá para ignorar se não foi a pessoa`, () => {
      assert.match(html, /Não foi você\?/);
      assert.match(html, /[Ii]gnore|ignorar/);
    });

    test(`${m.arquivo}: marca da casa (Sabor Local) e botão laranja`, () => {
      assert.ok(html.includes("Sabor"));
      assert.ok(html.includes("Local"));
      assert.ok(html.includes("#ea580c"));
    });
  }

  test("o modelo de troca de e-mail mostra o endereço antigo e o novo", () => {
    const html = ler("templates/troca-email.html");
    assert.match(html, /\{\{ \.Email \}\}[\s\S]*\{\{ \.NewEmail \}\}/);
  });

  test("o modelo de recuperação não fala em criar conta nem em aprovar perfil", () => {
    const html = ler("templates/recuperacao.html");
    assert.ok(!/criar sua conta/i.test(html));
    assert.ok(!/conferência rápida/i.test(html));
  });
});
