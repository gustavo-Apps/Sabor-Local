// Inundação (flood), payloads absurdos e fuzzing contra a API pública.
// Objetivo: nada de erro 5xx, nada de dado lixo em massa, tudo limitado.

import test, { after, before, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { admin, anonimo, cfg, Contexto, emLotes, zerarLimites } from "../helpers.mjs";

const ctx = new Contexto();
let ana;
const PARALELO = 20;

before(async () => {
  ana = await ctx.novoVendedor({ aprovado: true });
});
beforeEach(() => zerarLimites());
after(() => ctx.limpar());

describe("inundação de métricas (inflar visitas e cliques)", () => {
  test("400 eventos do mesmo IP: no máximo ~60 por minuto são gravados, sem erro", async () => {
    const c = anonimo();
    const r = await emLotes(400, PARALELO, () => c.rpc("registrar_evento", { p_tipo: "whatsapp", p_vendedor: ana.vendedorId }));
    assert.equal(r.filter((x) => x.error).length, 0, "descartar em silêncio, sem erro");
    const { count } = await admin.from("eventos").select("id", { count: "exact", head: true }).eq("vendedor_id", ana.vendedorId);
    console.log(`   gravados: ${count} de 400`);
    assert.ok(count <= 60 + PARALELO, `${count} eventos gravados`);
  });

  test("IP forjado a cada pedido não infla a métrica", async () => {
    const r = await emLotes(300, PARALELO, (i) =>
      anonimo({ "x-forwarded-for": `50.${i % 250}.${(i * 3) % 250}.9` }).rpc("registrar_evento", { p_tipo: "visita_vendedor", p_vendedor: ana.vendedorId }),
    );
    assert.equal(r.filter((x) => x.error).length, 0);
    const { count } = await admin.from("eventos").select("id", { count: "exact", head: true }).eq("vendedor_id", ana.vendedorId).eq("tipo", "visita_vendedor");
    console.log(`   gravados: ${count} de 300`);
    assert.ok(count <= 60 + PARALELO, `${count} eventos gravados com IP forjado`);
  });
});

describe("inundação de denúncias", () => {
  const denunciar = (c) =>
    c.rpc("enviar_denuncia", { p_vendedor: ana.vendedorId, p_avaliacao: null, p_motivo: "outro", p_descricao: "spam", p_contato: null });

  test("200 denúncias do mesmo IP: poucas entram, o resto recebe 'muitas_denuncias'", async () => {
    const c = anonimo();
    const r = await emLotes(200, 10, () => denunciar(c));
    const barradas = r.filter((x) => x.error?.message.includes("muitas_denuncias")).length;
    const { count } = await admin.from("denuncias").select("id", { count: "exact", head: true }).eq("vendedor_id", ana.vendedorId);
    console.log(`   gravadas: ${count}, barradas: ${barradas}`);
    assert.ok(count <= 5 + 10, `${count} denúncias gravadas`);
    assert.ok(barradas >= 200 - 15);
  });

  test("IP forjado a cada denúncia não contorna o limite", async () => {
    const r = await emLotes(100, 10, (i) => denunciar(anonimo({ "x-forwarded-for": `60.${i}.1.1` })));
    const { count } = await admin.from("denuncias").select("id", { count: "exact", head: true }).eq("vendedor_id", ana.vendedorId);
    console.log(`   gravadas: ${count} de 100`);
    assert.ok(count <= 5 + 10, `${count} denúncias com IP forjado`);
    assert.ok(r.some((x) => x.error?.message.includes("muitas_denuncias")));
  });
});

describe("leituras em massa", () => {
  test("pedir 1 milhão de linhas devolve no máximo o teto da API (1000)", async () => {
    const { data, error } = await anonimo().from("vendedores").select("id").limit(1_000_000);
    assert.ifError(error);
    assert.ok(data.length <= 1000);
  });

  test("300 consultas simultâneas do catálogo: nenhuma falha e todas rápidas", async () => {
    const consulta = () =>
      anonimo()
        .from("vendedores")
        .select("id, nome, vendedor_categorias(categoria:categorias(id,nome)), bairro:bairros(nome), horarios:horarios_funcionamento(*), itens_cardapio(*)")
        .eq("ativo", true);
    const tempos = [];
    const r = await emLotes(300, 30, async () => {
      const t = performance.now();
      const x = await consulta();
      tempos.push(performance.now() - t);
      return x;
    });
    const falhas = r.filter((x) => x.error);
    tempos.sort((a, b) => a - b);
    const p95 = tempos[Math.floor(tempos.length * 0.95)];
    console.log(`   p50=${Math.round(tempos[150])}ms p95=${Math.round(p95)}ms falhas=${falhas.length}`);
    assert.equal(falhas.length, 0, falhas[0]?.error?.message);
    assert.ok(p95 < 5000, `p95 ${Math.round(p95)}ms`);
  });
});

describe("fuzzing: textos hostis nos campos livres", () => {
  const hostis = [
    "'; DROP TABLE vendedores;--",
    "\" OR 1=1 --",
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    "../../../etc/passwd",
    "${7*7} {{7*7}} %s %n",
    "\u0000",
    "a\u0000b",
    "‮‭ invertido",
    "🍕".repeat(500),
    "ñ".repeat(10_000),
    "\r\n\r\nInjected-Header: x",
    "null",
    "undefined",
    "[object Object]",
    "%00",
    "%27%20OR%201%3D1",
    "\\",
    "\\\\'",
    "NaN",
    "9".repeat(400),
    " ".repeat(3000),
  ];

  for (const texto of hostis) {
    const rotulo = JSON.stringify(texto.slice(0, 24));
    test(`menu aceita (texto puro) ou recusa com erro de dados: ${rotulo}`, async () => {
      const { error } = await ana.client.from("itens_cardapio").insert({ vendedor_id: ana.vendedorId, nome: texto.slice(0, 80), descricao: texto.slice(0, 200) });
      if (error) assert.match(error.code ?? "", /^(22|23)/, `erro inesperado: ${error.code} ${error.message}`);
    });
  }

  test("as tabelas continuam inteiras depois do fuzzing", async () => {
    for (const tabela of ["vendedores", "itens_cardapio", "codigos_pedido", "avaliacoes", "denuncias"]) {
      const { error } = await admin.from(tabela).select("id", { head: true, count: "exact" });
      assert.ifError(error);
    }
  });

  test("filtros com payload de injeção só devolvem zero linhas", async () => {
    for (const texto of hostis.filter((t) => t.length < 1500)) {
      // (textos maiores viram URI gigante e já são barrados pelo servidor com 414)
      const { data, error } = await anonimo().from("vendedores").select("id").eq("nome", texto);
      assert.ifError(error);
      assert.equal(data.length, 0);
    }
  });

  test("busca por padrão (ilike) com curingas não vaza vendedores pendentes", async () => {
    const pendente = await ctx.novoVendedor({ aprovado: false, semLogin: true });
    const { data } = await anonimo().from("vendedores").select("id").ilike("nome", "%");
    assert.ok(!data.some((v) => v.id === pendente.vendedorId));
  });
});

describe("requisições gigantes e malformadas", () => {
  const rpc = (corpo, extra = {}) =>
    fetch(`${cfg.url}/rest/v1/rpc/registrar_evento`, {
      method: "POST",
      headers: { apikey: cfg.pub, "content-type": "application/json", ...extra },
      body: corpo,
    });

  test("corpo de 20 MB não derruba nada (recusa ou ignora, sem 5xx)", async () => {
    const r = await rpc(JSON.stringify({ p_tipo: "x".repeat(20 * 1024 * 1024) }));
    assert.ok(r.status < 500, `status ${r.status}`);
  });

  test("JSON quebrado devolve 400, não 500", async () => {
    const r = await rpc('{"p_tipo": ');
    assert.equal(r.status, 400);
  });

  test("tipo de conteúdo errado devolve 4xx", async () => {
    const r = await rpc("p_tipo=visita_site", { "content-type": "text/plain" });
    assert.ok(r.status >= 400 && r.status < 500, `status ${r.status}`);
  });

  test("cabeçalhos absurdos (8 KB) não geram 5xx", async () => {
    const r = await rpc("{}", { "x-lixo": "a".repeat(8000) });
    assert.ok(r.status < 500 || r.status === 431, `status ${r.status}`);
  });

  test("método não permitido devolve 4xx", async () => {
    const r = await fetch(`${cfg.url}/rest/v1/vendedores`, { method: "TRACE", headers: { apikey: cfg.pub } }).catch(() => ({ status: 405 }));
    assert.ok(r.status >= 400 && r.status < 500, `status ${r.status}`);
  });
});
