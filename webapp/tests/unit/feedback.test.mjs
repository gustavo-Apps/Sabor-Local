// Link da issue e filtros do "Fale conosco" (sem banco, sem rede).

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { caminhoInterno, issueDoRepositorio, linkNovaIssue, REPOSITORIO } from "../../src/lib/feedback.ts";

describe("linkNovaIssue", () => {
  const f = { tipo: "problema", mensagem: "O botão não responde\nTentei três vezes", pagina: "/painel" };

  test("monta o link do repositório com título, texto e rótulo", () => {
    const u = new URL(linkNovaIssue(f));
    assert.equal(`${u.origin}${u.pathname}`, `${REPOSITORIO}/issues/new`);
    assert.equal(u.searchParams.get("title"), "Problema: O botão não responde");
    assert.equal(u.searchParams.get("labels"), "bug");
    assert.match(u.searchParams.get("body"), /Tentei três vezes/);
    assert.match(u.searchParams.get("body"), /Página: \/painel/);
  });

  test("rótulos por tipo", () => {
    assert.equal(new URL(linkNovaIssue({ ...f, tipo: "sugestao" })).searchParams.get("labels"), "enhancement");
    assert.equal(new URL(linkNovaIssue({ ...f, tipo: "duvida" })).searchParams.get("labels"), "question");
  });

  test("título longo é cortado e a página ausente é informada", () => {
    const u = new URL(linkNovaIssue({ ...f, mensagem: "a".repeat(200), pagina: null }));
    assert.ok(u.searchParams.get("title").length <= 82);
    assert.match(u.searchParams.get("body"), /Página: não informada/);
  });

  test("caracteres especiais não quebram o link", () => {
    const u = new URL(linkNovaIssue({ ...f, mensagem: "a&b=c#d ?e <b>x</b> 😀" }));
    assert.match(u.searchParams.get("body"), /a&b=c#d \?e <b>x<\/b> 😀/);
  });
});

describe("issueDoRepositorio", () => {
  test("aceita só issue do próprio repositório", () => {
    assert.equal(issueDoRepositorio(`${REPOSITORIO}/issues/12`), `${REPOSITORIO}/issues/12`);
    assert.equal(issueDoRepositorio("https://evil.com/issues/1"), null);
    assert.equal(issueDoRepositorio("javascript:alert(1)"), null);
    assert.equal(issueDoRepositorio(`${REPOSITORIO}/issues/1 outra coisa`), null);
    assert.equal(issueDoRepositorio("  "), null);
  });
});

describe("caminhoInterno", () => {
  test("só aceita caminhos do próprio site", () => {
    assert.equal(caminhoInterno("/painel"), "/painel");
    assert.equal(caminhoInterno("https://evil.com"), "");
    assert.equal(caminhoInterno("//evil.com"), "");
    assert.equal(caminhoInterno("/\\evil.com"), "");
    assert.equal(caminhoInterno(undefined), "");
    assert.equal(caminhoInterno("/" + "a".repeat(250)), "");
  });
});
