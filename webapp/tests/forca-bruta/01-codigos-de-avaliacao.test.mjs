// Força bruta massiva contra os códigos de avaliação (verificação de compra).
// O atacante quer acertar um código de 6 caracteres para publicar avaliação
// falsa. O limite é de 10 erros por hora por IP.

import test, { after, before, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { admin, anonimo, Contexto, emLotes, zerarLimites } from "../helpers.mjs";

const ctx = new Contexto();
let ana;
const PARALELO = 20;
const FOLGA = PARALELO; // pedidos já em voo quando o limite é atingido

before(async () => {
  ana = await ctx.novoVendedor({ aprovado: true, semLogin: true });
});
beforeEach(async () => {
  await zerarLimites();
  await admin.from("codigos_pedido").delete().eq("vendedor_id", ana.vendedorId);
  await admin.from("codigos_pedido").insert({ vendedor_id: ana.vendedorId, codigo: "BR2345" });
});
after(() => ctx.limpar());

const palpite = (cliente, codigo) =>
  cliente.rpc("enviar_avaliacao", { p_vendedor: ana.vendedorId, p_nota: 5, p_comentario: "fraude", p_codigo: codigo });

const contar = (resultados) =>
  resultados.reduce((acc, r) => ((acc[r.data ?? `erro:${r.error?.code}`] = (acc[r.data ?? `erro:${r.error?.code}`] ?? 0) + 1), acc), {});

const codigoErrado = (i) => `A${String(i).padStart(5, "0").replace(/[01OI]/g, "7")}`;

describe("palpites em massa", () => {
  test("500 palpites errados do mesmo IP: poucos são processados, o resto é barrado", async () => {
    const cliente = anonimo();
    const r = await emLotes(500, PARALELO, (i) => palpite(cliente, codigoErrado(i)));
    const total = contar(r);
    console.log("   resultado:", JSON.stringify(total));

    assert.equal(total.ok ?? 0, 0, "ninguém pode acertar");
    assert.ok((total.codigo_invalido ?? 0) <= 10 + FOLGA, `processou ${total.codigo_invalido} palpites antes de travar`);
    assert.ok((total.muitas_tentativas ?? 0) >= 500 - (10 + FOLGA), "o restante precisa ser barrado");

    const { count } = await admin.from("tentativas_codigo").select("id", { count: "exact", head: true });
    assert.ok(count <= 10 + FOLGA, `${count} tentativas registradas`);
  });

  test("durante o bloqueio até o código CERTO é recusado e não é consumido", async () => {
    const cliente = anonimo();
    await emLotes(60, PARALELO, (i) => palpite(cliente, codigoErrado(i)));
    const { data } = await palpite(cliente, "BR2345");
    assert.equal(data, "muitas_tentativas");
    const { data: cod } = await admin.from("codigos_pedido").select("usado_em").eq("codigo", "BR2345").single();
    assert.equal(cod.usado_em, null, "código preservado para o cliente legítimo");
  });

  test("forjar X-Forwarded-For diferente a cada palpite NÃO contorna o limite", async () => {
    const r = await emLotes(300, PARALELO, (i) =>
      palpite(anonimo({ "x-forwarded-for": `10.${i % 250}.${(i * 7) % 250}.${(i * 13) % 250}` }), codigoErrado(i)),
    );
    const total = contar(r);
    console.log("   resultado:", JSON.stringify(total));
    assert.equal(total.ok ?? 0, 0);
    assert.ok((total.codigo_invalido ?? 0) <= 10 + FOLGA, `IP forjado deixou passar ${total.codigo_invalido} palpites`);
  });

  test("forjar x-real-ip e cf-connecting-ip também não contorna (o proxy sobrescreve x-real-ip)", async () => {
    const r = await emLotes(200, PARALELO, (i) =>
      palpite(anonimo({ "x-real-ip": `20.0.${i % 250}.1`, "cf-connecting-ip": `30.0.${i % 250}.1` }), codigoErrado(i)),
    );
    const total = contar(r);
    console.log("   resultado:", JSON.stringify(total));
    assert.equal(total.ok ?? 0, 0);
    assert.ok((total.codigo_invalido ?? 0) <= 10 + FOLGA, `cabeçalho forjado deixou passar ${total.codigo_invalido} palpites`);
  });

  test("passada a janela de bloqueio, o cliente legítimo consegue avaliar", async () => {
    const cliente = anonimo();
    await emLotes(60, PARALELO, (i) => palpite(cliente, codigoErrado(i)));
    await admin.from("tentativas_codigo").delete().gte("id", 0); // simula 1 hora depois
    const { data } = await palpite(cliente, "BR2345");
    assert.equal(data, "ok");
  });

  test("o código tem espaço de busca grande o bastante (31^6 ≈ 887 milhões)", () => {
    const alfabeto = 32 - 1; // sem 0/O/1/I o app usa 32 símbolos; folga de 1
    const combinacoes = alfabeto ** 6;
    const palpitesPorHora = 10; // limite do banco
    const anos = combinacoes / palpitesPorHora / 24 / 365;
    assert.ok(anos > 1000, `um único IP levaria ${Math.round(anos)} anos`);
  });
});

describe("limite por vendedor quando o IP não é confiável", () => {
  test("100 erros por hora no mesmo vendedor travam todo mundo (anti botnet)", async () => {
    // simula uma botnet: tentativas de muitos IPs diferentes gravadas direto
    const linhas = Array.from({ length: 100 }, (_, i) => ({ vendedor_id: ana.vendedorId, ip_hash: `bot-${i}` }));
    await admin.from("tentativas_codigo").insert(linhas);
    const { data } = await palpite(anonimo(), "BR2345");
    assert.equal(data, "muitas_tentativas");
  });
});
