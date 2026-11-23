// CSP em modo só relatar: política e resumo dos relatórios (sem banco, sem rede).

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { limparEndereco, montarCspReportOnly, resumirRelatorioCsp } from "../../src/lib/csp.ts";

describe("montarCspReportOnly", () => {
  const diretivas = (csp) => Object.fromEntries(csp.split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1)]));

  test("tem as diretivas essenciais e o endereço de relatório", () => {
    const d = diretivas(montarCspReportOnly("https://abc.supabase.co", false));
    assert.deepEqual(d["default-src"], ["'self'"]);
    assert.deepEqual(d["object-src"], ["'none'"]);
    assert.deepEqual(d["frame-ancestors"], ["'none'"]);
    assert.deepEqual(d["base-uri"], ["'self'"]);
    assert.deepEqual(d["form-action"], ["'self'"]);
    assert.deepEqual(d["report-uri"], ["/csp-report"]);
  });

  test("libera só o próprio site e o Supabase em imagens e conexões (https vira wss)", () => {
    const d = diretivas(montarCspReportOnly("https://abc.supabase.co/rest/v1", false));
    assert.deepEqual(d["img-src"], ["'self'", "data:", "blob:", "https://abc.supabase.co"]);
    assert.deepEqual(d["connect-src"], ["'self'", "https://abc.supabase.co", "wss://abc.supabase.co"]);
  });

  test("no Supabase local (http) usa ws://", () => {
    const d = diretivas(montarCspReportOnly("http://127.0.0.1:54321", false));
    assert.ok(d["connect-src"].includes("ws://127.0.0.1:54321"));
  });

  test("'unsafe-eval' só aparece em desenvolvimento", () => {
    assert.ok(!montarCspReportOnly("https://x.supabase.co", false).includes("unsafe-eval"));
    assert.ok(montarCspReportOnly("https://x.supabase.co", true).includes("'unsafe-eval'"));
  });

  test("sem endereço do Supabase, ou com endereço inválido, segue só com o próprio site", () => {
    for (const u of [undefined, "", "isso não é endereço"]) {
      const d = diretivas(montarCspReportOnly(u, false));
      assert.deepEqual(d["connect-src"], ["'self'"], String(u));
      assert.deepEqual(d["img-src"], ["'self'", "data:", "blob:"], String(u));
    }
  });

  test("nunca libera curinga nem esquema aberto", () => {
    const csp = montarCspReportOnly("https://abc.supabase.co", true);
    assert.ok(!/(^|\s)\*(\s|;|$)/.test(csp), "curinga solto");
    assert.ok(!/ https:( |;|$)/.test(csp), "https: aberto");
  });
});

describe("limparEndereco", () => {
  test("tira parâmetros e âncora", () => {
    assert.equal(limparEndereco("https://site.com/vendedores/abc?origem=whatsapp#topo"), "https://site.com/vendedores/abc");
  });

  test("esconde o segredo do link de avaliação", () => {
    const token = "a".repeat(64);
    assert.equal(limparEndereco(`https://site.com/avaliar/${token}`), "https://site.com/avaliar/*");
    assert.equal(limparEndereco(`https://site.com/avaliar/${token}?x=1`), "https://site.com/avaliar/*");
    assert.ok(!limparEndereco(`http://localhost:3000/avaliar/${token}/`).includes(token));
  });

  test("endereço que não é URL só perde o que vem depois de ? e #", () => {
    assert.equal(limparEndereco("inline"), "inline");
    assert.equal(limparEndereco("eval?segredo=1"), "eval");
  });

  test("entradas estranhas viram texto vazio ou curto, nunca erro", () => {
    for (const e of [null, undefined, 5, {}, [], "", "x".repeat(10000)]) assert.doesNotThrow(() => limparEndereco(e));
    assert.equal(limparEndereco(null), "");
    assert.ok(limparEndereco("https://s.com/" + "a".repeat(5000)).length <= 200);
  });
});

describe("resumirRelatorioCsp", () => {
  test("formato antigo (csp-report)", () => {
    const r = resumirRelatorioCsp({
      "csp-report": { "document-uri": "https://s.com/p?x=1", "violated-directive": "script-src 'self'", "effective-directive": "script-src", "blocked-uri": "https://evil.com/a.js?k=2" },
    });
    assert.deepEqual(r, { diretiva: "script-src", bloqueado: "https://evil.com/a.js", pagina: "https://s.com/p" });
  });

  test("formato novo (Reporting API, uma lista)", () => {
    const r = resumirRelatorioCsp([{ type: "csp-violation", body: { documentURL: "https://s.com/", effectiveDirective: "img-src", blockedURL: "https://cdn.x.com/i.png" } }]);
    assert.deepEqual(r, { diretiva: "img-src", bloqueado: "https://cdn.x.com/i.png", pagina: "https://s.com/" });
  });

  test("blocked-uri 'inline' e 'eval' (palavras, não endereços) são mantidos", () => {
    assert.equal(resumirRelatorioCsp({ "csp-report": { "effective-directive": "script-src", "blocked-uri": "inline", "document-uri": "https://s.com/" } }).bloqueado, "inline");
    assert.equal(resumirRelatorioCsp({ "csp-report": { "effective-directive": "script-src", "blocked-uri": "eval" } }).bloqueado, "eval");
  });

  test("o token do link de avaliação não vaza nem no endereço da página nem no bloqueado", () => {
    const t = "b".repeat(64);
    const r = resumirRelatorioCsp({ "csp-report": { "effective-directive": "style-src", "document-uri": `https://s.com/avaliar/${t}`, "blocked-uri": `https://s.com/avaliar/${t}/x.css` } });
    assert.ok(!JSON.stringify(r).includes(t));
  });

  test("texto livre do relatório (amostra do script, política completa) nunca entra no resumo", () => {
    const r = resumirRelatorioCsp({ "csp-report": { "effective-directive": "script-src", "script-sample": "document.cookie='segredo'", "original-policy": "default-src 'self'", "source-file": "https://s.com/a.js" } });
    assert.deepEqual(Object.keys(r).sort(), ["bloqueado", "diretiva", "pagina"]);
    assert.ok(!JSON.stringify(r).includes("segredo"));
  });

  test("campos muito longos são cortados", () => {
    const r = resumirRelatorioCsp({ "csp-report": { "effective-directive": "x".repeat(1000), "document-uri": "https://s.com/" + "a".repeat(1000) } });
    assert.ok(r.diretiva.length <= 200 && r.pagina.length <= 200);
  });

  for (const [nome, entrada] of [["nulo", null], ["texto", "oi"], ["número", 42], ["lista vazia", []], ["objeto vazio", {}], ["sem diretiva", { "csp-report": { "document-uri": "https://s.com/" } }], ["corpo errado", { body: "texto" }], ["lista de nulos", [null]]]) {
    test(`não é relatório: ${nome}`, () => assert.equal(resumirRelatorioCsp(entrada), null));
  }
});
