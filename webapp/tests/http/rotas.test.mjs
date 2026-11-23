// Endpoints HTTP do Next.js. Precisa do app rodando (padrão http://localhost:3000;
// mude com TEST_BASE_URL). Se o servidor não estiver no ar, os testes são pulados.
//
//   npm run build && npx next start -p 3055
//   TEST_BASE_URL=http://localhost:3055 npm run test:http

import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { admin, cfg, Contexto, emLotes, sufixo } from "../helpers.mjs";

const BASE = (process.env.TEST_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const ctx = new Contexto();
let no_ar = false;
let aprovado;
let pendente;
let xss;
let destacado;
let normal;
let cidadeB;
let vendedorCidadeB;
let cidadePadrao;

const get = (caminho, opcoes = {}) => fetch(`${BASE}${caminho}`, { redirect: "manual", ...opcoes });

before(async () => {
  try {
    const r = await fetch(`${BASE}/robots.txt`, { signal: AbortSignal.timeout(4000) });
    no_ar = r.ok;
  } catch {
    no_ar = false;
  }
  if (!no_ar) {
    console.log(`   Servidor fora do ar em ${BASE}: testes HTTP pulados.`);
    return;
  }
  aprovado = await ctx.novoVendedor({ aprovado: true, semLogin: true });
  pendente = await ctx.novoVendedor({ aprovado: false, semLogin: true });
  xss = await ctx.novoVendedor({ aprovado: true, semLogin: true });
  destacado = await ctx.novoVendedor({ aprovado: true, semLogin: true });
  normal = await ctx.novoVendedor({ aprovado: true, semLogin: true });
  // "ZZ" ganharia de "AA" só se o destaque funcionar (a ordem alfabética daria o contrário)
  await admin.from("vendedores").update({ nome: "ZZ Pizzaria Destacada", destaque_ate: new Date(Date.now() + 86400000).toISOString() }).eq("id", destacado.vendedorId);
  await admin.from("vendedores").update({ nome: "AA Pizzaria Normal" }).eq("id", normal.vendedorId);

  // segunda cidade, com um bairro e um vendedor, para testar o seletor de cidade
  const s = sufixo();
  ({ data: cidadePadrao } = await admin.from("cidades").select("id, slug").order("created_at").limit(1).single());
  ({ data: cidadeB } = await admin.from("cidades").insert({ nome: `Aaa Cidade Teste ${s}`, slug: `cidade-teste-${s}`, uf: "RS" }).select().single());
  const { data: bairroB } = await admin.from("bairros").insert({ nome: "Centro", cidade_id: cidadeB.id }).select().single();
  vendedorCidadeB = await ctx.novoVendedor({ aprovado: true, semLogin: true });
  await admin.from("vendedores").update({ nome: "Pizzaria Exclusiva da Cidade B", bairro_id: bairroB.id }).eq("id", vendedorCidadeB.vendedorId);
  await admin
    .from("vendedores")
    .update({ nome: "</script><img src=x onerror=alert(1)>", descricao: "<script>alert('xss')</script>" })
    .eq("id", xss.vendedorId);
});
after(async () => {
  await ctx.limpar();
  if (cidadeB) {
    await admin.from("bairros").delete().eq("cidade_id", cidadeB.id);
    await admin.from("cidades").delete().eq("id", cidadeB.id);
  }
});

const pula = (t) => (no_ar ? false : t.skip("servidor fora do ar") ?? true);

describe("páginas públicas", () => {
  for (const caminho of ["/", "/sobre", "/contribuicao", "/termos", "/privacidade", "/login", "/feedback"]) {
    test(`GET ${caminho} responde 200 em HTML`, async (t) => {
      if (pula(t)) return;
      const r = await get(caminho);
      assert.equal(r.status, 200);
      assert.match(r.headers.get("content-type") ?? "", /text\/html/);
    });
  }

  test("a página inicial já é a visão de cliente (catálogo), não a página Sobre", async (t) => {
    if (pula(t)) return;
    const html = await (await get("/")).text();
    assert.match(html, /Todos os vendedores|vendedor(es)? encontrado/i, "catálogo na home");
    assert.ok(!html.includes("Como será desenvolvido"), "conteúdo de Sobre não pode estar na home");
  });

  test("plano destaque: o vendedor em destaque aparece antes dos demais na lista da home", async (t) => {
    if (pula(t)) return;
    const html = await (await get("/")).text();
    const lista = html.slice(html.indexOf("Todos os vendedores"));
    const iDestaque = lista.indexOf("ZZ Pizzaria Destacada");
    const iNormal = lista.indexOf("AA Pizzaria Normal");
    assert.ok(iDestaque >= 0 && iNormal >= 0, "os dois aparecem na lista");
    assert.ok(iDestaque < iNormal, "destacado antes do normal, mesmo com nome alfabeticamente posterior");
    assert.match(html, /Destaque/);
  });

  test("perfil do vendedor em destaque mostra o selo", async (t) => {
    if (pula(t)) return;
    const html = await (await get(`/vendedores/${destacado.vendedorId}`)).text();
    assert.match(html, /★ Destaque/);
    const semSelo = await (await get(`/vendedores/${normal.vendedorId}`)).text();
    assert.ok(!semSelo.includes("★ Destaque"));
  });

  test("endereço antigo /catalogo redireciona (permanente) para a home", async (t) => {
    if (pula(t)) return;
    const r = await get("/catalogo");
    assert.ok([301, 307, 308].includes(r.status), `status ${r.status}`);
    assert.equal(new URL(r.headers.get("location"), BASE).pathname, "/");
  });

  test("Sobre e Contribuição têm o conteúdo certo", async (t) => {
    if (pula(t)) return;
    const sobre = await (await get("/sobre")).text();
    assert.match(sobre, /Como será desenvolvido/);
    assert.ok(!sobre.includes("Deseja contribuir com o projeto"), "contribuição saiu da página Sobre");
    const contrib = await (await get("/contribuicao")).text();
    assert.match(contrib, /Deseja contribuir com o projeto/);
    assert.match(contrib, /github\.com\/gustavo-Apps/);
  });

  test("o rodapé (em todas as páginas) leva a Sobre, Contribuição e GitHub", async (t) => {
    if (pula(t)) return;
    for (const caminho of ["/", "/sobre", "/contribuicao", "/login"]) {
      const html = await (await get(caminho)).text();
      const rodape = html.slice(html.indexOf("<footer"), html.indexOf("</footer>"));
      assert.match(rodape, /href="\/sobre"/, `${caminho}: link Sobre no rodapé`);
      assert.match(rodape, /href="\/contribuicao"/, `${caminho}: link Contribuição no rodapé`);
      assert.match(rodape, /href="https:\/\/github\.com\/gustavo-Apps"/, `${caminho}: link GitHub no rodapé`);
    }
  });

  test("o menu do topo não tem Sobre nem Contribuição (só Cliente e Vendedor)", async (t) => {
    if (pula(t)) return;
    const html = await (await get("/")).text();
    const topo = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    assert.ok(!topo.includes('href="/sobre"') && !topo.includes('href="/contribuicao"'));
    assert.match(topo, /Sou cliente/);
    assert.match(topo, /href="\/painel"/);
  });

  test("perfil de vendedor aprovado abre e mostra o nome", async (t) => {
    if (pula(t)) return;
    const r = await get(`/vendedores/${aprovado.vendedorId}`);
    assert.equal(r.status, 200);
    assert.match(await r.text(), /Lanchonete/);
  });

  test("item indisponível continua no perfil, com selo, no fim da lista", async (t) => {
    if (pula(t)) return;
    const dono = await ctx.novoVendedor({ aprovado: true, semLogin: true });
    const { error } = await admin.from("itens_cardapio").insert([
      { vendedor_id: dono.vendedorId, nome: "Item Esgotado Sem Previsao", ordem: 0, disponivel: false, indisponivel_ate: null },
      { vendedor_id: dono.vendedorId, nome: "Item Normal Do Dia", ordem: 1, disponivel: true, indisponivel_ate: null },
      { vendedor_id: dono.vendedorId, nome: "Item Esgotado Ontem", ordem: 2, disponivel: false, indisponivel_ate: "2000-01-01" },
      { vendedor_id: dono.vendedorId, nome: "Item Acabou Hoje", ordem: 3, disponivel: false, indisponivel_ate: "2999-12-31" },
    ]);
    assert.ifError(error);

    const html = (await (await get(`/vendedores/${dono.vendedorId}`)).text()).replace(/<script[\s\S]*?<\/script>/g, "");
    const pos = (nome) => html.indexOf(nome);
    for (const nome of ["Item Esgotado Sem Previsao", "Item Normal Do Dia", "Item Esgotado Ontem", "Item Acabou Hoje"]) {
      assert.ok(pos(nome) > 0, `não mostrou: ${nome}`);
    }
    // disponíveis primeiro (o que venceu ontem já voltou), indisponíveis no fim
    assert.ok(pos("Item Normal Do Dia") < pos("Item Esgotado Ontem"));
    assert.ok(pos("Item Esgotado Ontem") < pos("Item Esgotado Sem Previsao"));
    assert.ok(pos("Item Esgotado Sem Previsao") < pos("Item Acabou Hoje"));
    assert.match(html, /Indisponível no momento/);
    assert.match(html, /Indisponível hoje/);
    assert.equal((html.match(/Indisponível/g) ?? []).length, 2, "só os dois itens indisponíveis ganham selo");
  });

  test("o perfil abre com ?origem= (conhecida, desconhecida ou hostil) sem erro e sem refletir o valor", async (t) => {
    if (pula(t)) return;
    for (const origem of ["whatsapp", "qr", "twitter", "<script>alert(1)</script>", "' or 1=1 --", "a".repeat(3000)]) {
      const r = await get(`/vendedores/${aprovado.vendedorId}?origem=${encodeURIComponent(origem)}`);
      assert.equal(r.status, 200, origem.slice(0, 30));
      const html = (await r.text()).replace(/<script[\s\S]*?<\/script>/g, "");
      assert.ok(!html.includes("alert(1)"), "refletiu a origem na página");
    }
  });

  test("perfil de vendedor PENDENTE devolve 404 (não vaza antes de aprovar)", async (t) => {
    if (pula(t)) return;
    assert.equal((await get(`/vendedores/${pendente.vendedorId}`)).status, 404);
  });

  test("id que não é UUID e UUID inexistente devolvem 404, nunca 500", async (t) => {
    if (pula(t)) return;
    for (const id of ["abc", "1", "'; drop table vendedores;--", "%00", "00000000-0000-0000-0000-000000000000"]) {
      const r = await get(`/vendedores/${encodeURIComponent(id)}`);
      assert.equal(r.status, 404, `id ${JSON.stringify(id)} -> ${r.status}`);
    }
  });

  test("rota inexistente devolve 404", async (t) => {
    if (pula(t)) return;
    assert.equal((await get("/nao-existe-essa-rota")).status, 404);
  });
});

describe("páginas legais (LGPD)", () => {
  test("Política de Privacidade traz controlador, dados, prazos e direitos", async (t) => {
    if (pula(t)) return;
    const html = await (await get("/privacidade")).text();
    for (const trecho of [
      "Quem é o responsável",
      "Quais dados coletamos",
      "Por quanto tempo guardamos",
      "Seus direitos",
      "13.709",
      "7 dias",
      "25 meses",
      "excluir a própria conta",
    ]) {
      assert.ok(html.includes(trecho), `falta: ${trecho}`);
    }
    assert.match(html, /Versão (<!-- -->)?2026-10/);
  });

  test("Termos de Uso deixam claro que o site não vende, não entrega e não processa pagamento", async (t) => {
    if (pula(t)) return;
    const html = await (await get("/termos")).text();
    assert.match(html, /não vende, não entrega e não processa pagamentos/);
    assert.match(html, /Plano destaque/);
    assert.match(html, /href="\/privacidade"/);
  });

  test("o rodapé de todas as páginas leva a Termos e Privacidade", async (t) => {
    if (pula(t)) return;
    for (const caminho of ["/", "/sobre", "/termos", "/privacidade", "/login"]) {
      const html = await (await get(caminho)).text();
      const rodape = html.slice(html.indexOf("<footer"), html.indexOf("</footer>"));
      assert.match(rodape, /href="\/termos"/, `${caminho}: Termos no rodapé`);
      assert.match(rodape, /href="\/privacidade"/, `${caminho}: Privacidade no rodapé`);
    }
  });

  test("as páginas legais estão no sitemap", async (t) => {
    if (pula(t)) return;
    const xml = await (await get("/sitemap.xml")).text();
    assert.ok(xml.includes("/termos") && xml.includes("/privacidade"));
  });
});

describe("várias cidades", () => {
  test("com mais de uma cidade ativa a home mostra o seletor de cidade", async (t) => {
    if (pula(t)) return;
    const html = await (await get("/")).text();
    assert.ok(html.includes(cidadeB.nome), "a segunda cidade aparece no seletor");
  });

  test("a página inicial padrão é a cidade MAIS ANTIGA, mesmo que a nova venha antes na ordem alfabética", async (t) => {
    if (pula(t)) return;
    const html = await (await get("/")).text();
    assert.ok(html.includes("ZZ Pizzaria Destacada"), "mostra a cidade padrão");
    assert.ok(!html.includes("Pizzaria Exclusiva da Cidade B"), "não troca para a cidade nova");
  });

  test("cidade sem vendedores mostra um convite para cadastrar o negócio", async (t) => {
    if (pula(t)) return;
    const { data: vazia } = await admin.from("cidades").insert({ nome: `Zzz Vazia ${sufixo()}`, slug: `zzz-vazia-${sufixo()}` }).select().single();
    try {
      const html = await (await get(`/?cidade=${vazia.slug}`)).text();
      assert.ok(html.includes("Ainda não há vendedores nesta cidade"));
      assert.match(html, /href="\/painel"/);
    } finally {
      await admin.from("cidades").delete().eq("id", vazia.id);
    }
  });

  test("?cidade= mostra só os vendedores daquela cidade", async (t) => {
    if (pula(t)) return;
    const daB = await (await get(`/?cidade=${cidadeB.slug}`)).text();
    assert.ok(daB.includes("Pizzaria Exclusiva da Cidade B"), "vendedor da cidade B aparece");
    assert.ok(!daB.includes("ZZ Pizzaria Destacada"), "vendedor da cidade padrão não aparece na cidade B");

    const daPadrao = await (await get(`/?cidade=${cidadePadrao.slug}`)).text();
    assert.ok(!daPadrao.includes("Pizzaria Exclusiva da Cidade B"), "vendedor da cidade B não aparece na cidade padrão");
    assert.ok(daPadrao.includes("ZZ Pizzaria Destacada"));
  });

  test("o cookie lembra a cidade escolhida", async (t) => {
    if (pula(t)) return;
    const html = await (await get("/", { headers: { cookie: `cidade=${cidadeB.slug}` } })).text();
    assert.ok(html.includes("Pizzaria Exclusiva da Cidade B"));
  });

  test("a URL vence o cookie", async (t) => {
    if (pula(t)) return;
    const html = await (await get(`/?cidade=${cidadePadrao.slug}`, { headers: { cookie: `cidade=${cidadeB.slug}` } })).text();
    assert.ok(!html.includes("Pizzaria Exclusiva da Cidade B"));
  });

  test("cidade desconhecida ou lixo na URL e no cookie cai na primeira, sem erro", async (t) => {
    if (pula(t)) return;
    for (const valor of ["nao-existe", "%00", "<script>alert(1)</script>", "../../etc", "a".repeat(5000), "__proto__"]) {
      const r = await get(`/?cidade=${encodeURIComponent(valor)}`, { headers: { cookie: `cidade=${encodeURIComponent(valor)}` } });
      assert.equal(r.status, 200, `valor ${JSON.stringify(valor.slice(0, 20))} -> ${r.status}`);
    }
  });

  test("cidade desativada some do seletor e a URL dela cai na primeira", async (t) => {
    if (pula(t)) return;
    await admin.from("cidades").update({ ativa: false }).eq("id", cidadeB.id);
    try {
      const html = await (await get(`/?cidade=${cidadeB.slug}`)).text();
      assert.ok(!html.includes("Pizzaria Exclusiva da Cidade B"), "cidade desativada não mostra vendedores");
    } finally {
      await admin.from("cidades").update({ ativa: true }).eq("id", cidadeB.id);
    }
  });

  test("o sitemap lista a página inicial de cada cidade quando há mais de uma", async (t) => {
    if (pula(t)) return;
    const xml = await (await get("/sitemap.xml")).text();
    assert.ok(xml.includes(`cidade=${cidadeB.slug}`));
  });

  test("o perfil do vendedor abre normalmente independente da cidade", async (t) => {
    if (pula(t)) return;
    assert.equal((await get(`/vendedores/${vendedorCidadeB.vendedorId}`)).status, 200);
  });
});

describe("fale conosco", () => {
  test("o rodapé de todas as páginas leva ao Fale conosco", async (t) => {
    if (pula(t)) return;
    for (const caminho of ["/", "/sobre", "/termos", "/login", "/feedback"]) {
      const html = await (await get(caminho)).text();
      const rodape = html.slice(html.indexOf("<footer"), html.indexOf("</footer>"));
      assert.match(rodape, /href="\/feedback"/, `${caminho}: Fale conosco no rodapé`);
    }
  });

  test("a página tem o formulário, o aviso de privacidade e está no sitemap", async (t) => {
    if (pula(t)) return;
    const html = await (await get("/feedback")).text();
    for (const trecho of ["Fale conosco", "Algo não funciona", "Tenho uma sugestão", "Tenho uma dúvida", "Enviar mensagem", "senhas"]) {
      assert.ok(html.includes(trecho), `falta: ${trecho}`);
    }
    assert.match(await (await get("/sitemap.xml")).text(), /\/feedback/);
  });

  test("?de= só aceita caminho interno e nunca vira link ou HTML", async (t) => {
    if (pula(t)) return;
    for (const de of ["https://evil.example/x", "//evil.example", "<script>alert(1)</script>", "/\\evil.example"]) {
      const r = await get(`/feedback?de=${encodeURIComponent(de)}`);
      assert.equal(r.status, 200);
      // os <script> do próprio Next repetem a URL no JSON interno; o que importa é a página visível
      const html = (await r.text()).replace(/<script[\s\S]*?<\/script>/g, "");
      assert.ok(!html.includes("evil.example"), `refletiu: ${de}`);
      assert.ok(!html.includes("alert(1)"), "HTML não escapado");
    }
  });

  test("security.txt: 404 sem e-mail de contato configurado, ou texto puro com Contact e Expires", async (t) => {
    if (pula(t)) return;
    const r = await get("/.well-known/security.txt");
    if (r.status === 404) return;
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type") ?? "", /text\/plain/);
    const txt = await r.text();
    assert.match(txt, /^Contact: mailto:/m);
    assert.match(txt, /^Expires: /m);
  });
});

describe("acabamento", () => {
  test("a página 404 é amigável, em português, e leva ao catálogo e ao Fale conosco", async (t) => {
    if (pula(t)) return;
    const r = await get("/nao-existe-mesmo");
    assert.equal(r.status, 404);
    const html = await r.text();
    assert.ok(html.includes("Página não encontrada"));
    assert.match(html, /href="\/feedback"/);
  });

  test("login, painel e admin pedem para não serem indexados", async (t) => {
    if (pula(t)) return;
    const html = await (await get("/login")).text();
    assert.match(html, /<meta name="robots" content="noindex/);
  });

  test("o topo do site avisa que é a versão beta", async (t) => {
    if (pula(t)) return;
    const html = await (await get("/")).text();
    const topo = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    assert.match(topo, />beta</i);
  });
});

describe("cookies e rastreadores (a decisão de não ter faixa de cookies depende disto)", () => {
  const PAGINAS = () => ["/", "/sobre", "/contribuicao", "/termos", "/privacidade", "/feedback", "/login", "/esqueci-senha", `/vendedores/${aprovado.vendedorId}`];

  test("visitante sem login não recebe nenhum cookie do servidor em nenhuma página pública", async (t) => {
    if (pula(t)) return;
    for (const caminho of PAGINAS()) {
      const r = await get(caminho);
      assert.equal(r.status, 200, caminho);
      assert.deepEqual(r.headers.getSetCookie(), [], `${caminho} gravou cookie: ${r.headers.getSetCookie().join(" | ")}`);
      await r.arrayBuffer();
    }
  });

  test("nenhuma página pública carrega script, estilo, imagem, fonte ou quadro de outro site", async (t) => {
    if (pula(t)) return;
    const base = new URL(BASE);
    // O Storage do próprio Supabase (fotos, logo e banner da loja) é o nosso back-end, não um site de terceiros. Sem a variável
    // no ambiente do teste, vale a URL do Supabase local que os outros testes já usam.
    const supabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? cfg.url).origin;
    const permitido = (endereco) => {
      if (/^(\/(?!\/)|#|data:|blob:|mailto:|tel:)/.test(endereco)) return true; // do próprio site
      try {
        const u = new URL(endereco, base);
        return u.origin === base.origin || u.origin === supabase;
      } catch {
        return false;
      }
    };
    for (const caminho of PAGINAS()) {
      const html = await (await get(caminho)).text();
      const recursos = [
        ...[...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]),
        ...[...html.matchAll(/<link[^>]*\shref="([^"]+)"[^>]*rel="(?:stylesheet|preload|modulepreload|icon|preconnect|dns-prefetch)"/g)].map((m) => m[1]),
        ...[...html.matchAll(/<link[^>]*rel="(?:stylesheet|preload|modulepreload|preconnect|dns-prefetch)"[^>]*\shref="([^"]+)"/g)].map((m) => m[1]),
        ...[...html.matchAll(/<(?:img|iframe|source|video|audio|embed)[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]),
      ];
      for (const r of recursos) assert.ok(permitido(r), `${caminho} carrega recurso de fora: ${r}`);
    }
  });

  test("nenhuma página cita ferramentas conhecidas de rastreamento", async (t) => {
    if (pula(t)) return;
    const suspeitos = ["google-analytics", "googletagmanager", "gtag(", "fbq(", "facebook.net", "connect.facebook", "hotjar", "clarity.ms", "doubleclick", "plausible.io", "mixpanel", "segment.com", "tiktok.com/i18n/pixel"];
    for (const caminho of PAGINAS()) {
      const html = await (await get(caminho)).text();
      for (const s of suspeitos) assert.ok(!html.includes(s), `${caminho} cita ${s}`);
    }
  });

  test("a Política de Privacidade continua dizendo que não há faixa de cookies (e por quê)", async (t) => {
    if (pula(t)) return;
    const html = (await (await get("/privacidade")).text()).replace(/<script[\s\S]*?<\/script>/g, "");
    assert.ok(html.includes("não exibimos faixa de cookies"));
    assert.ok(html.includes("rastreadores de terceiros"));
  });
});

describe("reportar um problema no perfil", () => {
  const visivel = (html) => html.replace(/<script[\s\S]*?<\/script>/g, "");

  test("o perfil tem o link para o Fale conosco com a página de origem", async (t) => {
    if (pula(t)) return;
    const html = visivel(await (await get(`/vendedores/${aprovado.vendedorId}`)).text());
    const alvo = `/feedback?de=${encodeURIComponent(`/vendedores/${aprovado.vendedorId}`)}`;
    assert.ok(html.includes(`href="${alvo}"`), "faltou o link de reportar problema");
    assert.ok(html.includes("Reportar um problema no site"));
    assert.ok(html.includes("Denunciar"), "denunciar continua existindo, é outra coisa");
  });

  test("o Fale conosco aberto por esse link mostra a página sobre a qual a pessoa fala", async (t) => {
    if (pula(t)) return;
    const caminho = `/vendedores/${aprovado.vendedorId}`;
    const html = visivel(await (await get(`/feedback?de=${encodeURIComponent(caminho)}`)).text());
    assert.ok(html.includes("Você está falando sobre a página"));
    assert.ok(html.includes(caminho));
  });

  test("sem ?de= ou com endereço de fora, o aviso não aparece", async (t) => {
    if (pula(t)) return;
    for (const de of ["", "https://evil.example/x", "//evil.example", "javascript:alert(1)"]) {
      const html = visivel(await (await get(`/feedback${de ? `?de=${encodeURIComponent(de)}` : ""}`)).text());
      assert.ok(!html.includes("Você está falando sobre a página"), `apareceu com de=${de}`);
      assert.ok(!html.includes("evil.example"));
    }
  });
});

describe("link de pedidos próprio", () => {
  const visivel = (html) => html.replace(/<script[\s\S]*?<\/script>/g, "");

  test("com link: botão do site com atributos seguros, texto escapado e WhatsApp em segundo plano", async (t) => {
    if (pula(t)) return;
    const loja = await ctx.novoVendedor({ aprovado: true, semLogin: true });
    const { error } = await admin
      .from("vendedores")
      .update({ link_pedido_url: "https://meusite.com.br/cardapio?mesa=1", link_pedido_rotulo: "<b>Pedir</b> & ganhar" })
      .eq("id", loja.vendedorId);
    assert.ifError(error);

    const html = visivel(await (await get(`/vendedores/${loja.vendedorId}`)).text());
    const botao = html.match(/<a [^>]*href="https:\/\/meusite\.com\.br\/cardapio\?mesa=1"[^>]*>[\s\S]*?<\/a>/);
    assert.ok(botao, "o botão do site deveria aparecer");
    assert.match(botao[0], /target="_blank"/);
    assert.match(botao[0], /rel="noopener noreferrer nofollow ugc"/);
    assert.ok(botao[0].includes("&lt;b&gt;Pedir&lt;/b&gt; &amp; ganhar"), "o texto do botão precisa vir escapado");
    assert.ok(!html.includes("<b>Pedir</b>"), "HTML do texto não pode virar marcação");
    assert.ok(html.includes("Ou pedir pelo WhatsApp"), "com link, o WhatsApp vira a segunda opção");
  });

  test("sem texto próprio usa 'Fazer pedido no site'", async (t) => {
    if (pula(t)) return;
    const loja = await ctx.novoVendedor({ aprovado: true, semLogin: true });
    await admin.from("vendedores").update({ link_pedido_url: "https://outro.com.br" }).eq("id", loja.vendedorId);
    const html = visivel(await (await get(`/vendedores/${loja.vendedorId}`)).text());
    assert.ok(html.includes("Fazer pedido no site"));
  });

  test("sem link: só o botão normal do WhatsApp, como antes", async (t) => {
    if (pula(t)) return;
    const html = visivel(await (await get(`/vendedores/${aprovado.vendedorId}`)).text());
    assert.ok(html.includes("Pedir pelo WhatsApp"));
    assert.ok(!html.includes("Ou pedir pelo WhatsApp"));
    assert.ok(!html.includes("Fazer pedido no site"));
  });

  test("link de loja que ainda não foi aprovada não vaza", async (t) => {
    if (pula(t)) return;
    await admin.from("vendedores").update({ link_pedido_url: "https://pendente.com.br" }).eq("id", pendente.vendedorId);
    assert.equal((await get(`/vendedores/${pendente.vendedorId}`)).status, 404);
    for (const caminho of ["/", "/sitemap.xml"]) {
      assert.ok(!(await (await get(caminho)).text()).includes("pendente.com.br"), `vazou em ${caminho}`);
    }
  });
});

describe("avaliação por convite", () => {
  const visivel = (html) => html.replace(/<script[\s\S]*?<\/script>/g, "");

  test("link que não existe mostra aviso claro, sem indexar e sem repassar o endereço", async (t) => {
    if (pula(t)) return;
    for (const token of ["f".repeat(64), "curto", "' or 1=1 --", "0".repeat(200)]) {
      const r = await get(`/avaliar/${encodeURIComponent(token)}`);
      assert.equal(r.status, 200, token.slice(0, 20));
      const html = await r.text();
      assert.ok(visivel(html).includes("Este convite não pode ser usado"));
      assert.match(html, /<meta name="robots" content="noindex/);
      assert.match(html, /<meta name="referrer" content="no-referrer"/);
    }
  });

  test("link válido mostra a loja e o formulário; depois de usado, avisa que já foi usado", async (t) => {
    if (pula(t)) return;
    const loja = await ctx.novoVendedor({ aprovado: true, semLogin: true });
    const { data: convite } = await admin.rpc("criar_convite_avaliacao", { p_vendedor: loja.vendedorId, p_email: `http.${sufixo()}@exemplo.com` });

    const antes = visivel(await (await get(`/avaliar/${convite.token}`)).text());
    assert.ok(antes.includes("Como foi seu pedido na"));
    assert.ok(antes.includes("Enviar avaliação"));

    await admin.rpc("avaliar_por_convite", { p_token: convite.token, p_nota: 5, p_comentario: "ok" });
    const depois = visivel(await (await get(`/avaliar/${convite.token}`)).text());
    assert.ok(depois.includes("já foi usado"));
    assert.ok(!depois.includes("Enviar avaliação"));
  });

  test("o link do convite nunca aparece no perfil da loja nem em páginas públicas", async (t) => {
    if (pula(t)) return;
    const loja = await ctx.novoVendedor({ aprovado: true, semLogin: true });
    const { data: convite } = await admin.rpc("criar_convite_avaliacao", { p_vendedor: loja.vendedorId, p_email: `http.${sufixo()}@exemplo.com` });
    for (const caminho of [`/vendedores/${loja.vendedorId}`, "/", "/sitemap.xml"]) {
      assert.ok(!(await (await get(caminho)).text()).includes(convite.token), `vazou em ${caminho}`);
    }
  });

  test("o perfil não pede mais código e explica que o convite vai por e-mail", async (t) => {
    if (pula(t)) return;
    const html = visivel(await (await get(`/vendedores/${aprovado.vendedorId}`)).text());
    assert.ok(!html.includes("Código de verificação"));
    assert.ok(html.includes("por e-mail"));
  });

  test("o robots.txt não deixa indexar /avaliar", async (t) => {
    if (pula(t)) return;
    assert.match(await (await get("/robots.txt")).text(), /Disallow: \/avaliar/);
  });
});

describe("aviso de privacidade ao finalizar o pedido", () => {
  let loja;
  before(async () => {
    if (!no_ar) return;
    loja = await ctx.novoVendedor({ aprovado: true, semLogin: true });
    await admin.from("vendedores").update({ aceita_pedidos: true }).eq("id", loja.vendedorId);
    await admin.from("horarios_funcionamento").delete().eq("vendedor_id", loja.vendedorId);
    await admin
      .from("horarios_funcionamento")
      .insert(Array.from({ length: 7 }, (_, dia) => ({ vendedor_id: loja.vendedorId, dia_semana: dia, abre: "00:00", fecha: "00:00" })));
  });

  test("quem vai informar nome, telefone e endereço vê a finalidade, o prazo e o link da Política", async (t) => {
    if (pula(t)) return;
    const html = await (await get(`/vendedores/${loja.vendedorId}/pedido`)).text();
    assert.ok(html.includes("Seus dados:"));
    assert.ok(html.includes("90 dias"));
    assert.match(html, /href="\/privacidade"/);
  });

  test("loja que não recebe pedido não coleta dado nenhum, então não mostra o aviso", async (t) => {
    if (pula(t)) return;
    await admin.from("vendedores").update({ aceita_pedidos: false }).eq("id", loja.vendedorId);
    const html = await (await get(`/vendedores/${loja.vendedorId}/pedido`)).text();
    assert.ok(!html.includes("Seus dados:"));
    assert.ok(html.includes("não recebe pedidos pelo site"));
  });
});

describe("meus pedidos", () => {
  test("/meus-pedidos abre sem login, explica que a lista é só do aparelho e pede para não ser indexada", async (t) => {
    if (pula(t)) return;
    const r = await get("/meus-pedidos");
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.ok(html.includes("Meus pedidos"));
    assert.ok(html.includes("só neste aparelho"));
    assert.match(html, /<meta name="robots" content="noindex/);
  });

  test("a página não traz pedido nem dado de cliente (a lista só existe no navegador de cada pessoa)", async (t) => {
    if (pula(t)) return;
    const html = await (await get("/meus-pedidos")).text();
    assert.ok(!/[0-9a-f]{64}/.test(html), "nenhum link de pedido no HTML");
    assert.ok(!html.includes("Pedido nº"));
  });

  test("o robots.txt não deixa indexar /meus-pedidos", async (t) => {
    if (pula(t)) return;
    assert.match(await (await get("/robots.txt")).text(), /Disallow: \/meus-pedidos/);
  });
});

describe("baixar meus dados", () => {
  test("sem login, /painel/exportar manda para o login e não entrega arquivo", async (t) => {
    if (pula(t)) return;
    const r = await get("/painel/exportar");
    assert.ok([307, 308].includes(r.status), `status ${r.status}`);
    assert.match(r.headers.get("location") ?? "", /\/login/);
    assert.ok(!(r.headers.get("content-disposition") ?? "").includes("attachment"));
  });

  test("a Política de Privacidade diz que o vendedor baixa os próprios dados", async (t) => {
    if (pula(t)) return;
    const html = await (await get("/privacidade")).text();
    assert.ok(html.includes("Baixar meus dados"));
  });
});

describe("esqueci minha senha", () => {
  test("/esqueci-senha abre, tem o formulário e pede para não ser indexada", async (t) => {
    if (pula(t)) return;
    const r = await get("/esqueci-senha");
    assert.equal(r.status, 200);
    const html = await r.text();
    for (const trecho of ["Esqueci minha senha", "E-mail ou usuário", "Enviar o link"]) assert.ok(html.includes(trecho), `falta: ${trecho}`);
    assert.match(html, /<meta name="robots" content="noindex/);
  });

  test("a tela de login tem o link para recuperar a senha", async (t) => {
    if (pula(t)) return;
    const html = await (await get("/login")).text();
    assert.match(html, /href="\/esqueci-senha"/);
  });

  test("/redefinir-senha sem sessão volta ao login com aviso de link inválido", async (t) => {
    if (pula(t)) return;
    const r = await get("/redefinir-senha");
    assert.ok([307, 308].includes(r.status), `status ${r.status}`);
    assert.match(r.headers.get("location") ?? "", /\/login\?erro=link/);
  });

  test("o robots.txt não deixa indexar as telas de senha", async (t) => {
    if (pula(t)) return;
    const txt = await (await get("/robots.txt")).text();
    assert.match(txt, /Disallow: \/esqueci-senha/);
    assert.match(txt, /Disallow: \/redefinir-senha/);
  });

  test("o callback de login não aceita destino externo em next", async (t) => {
    if (pula(t)) return;
    for (const next of ["https://evil.example", "//evil.example", "/\evil.example"]) {
      const r = await get(`/auth/callback?next=${encodeURIComponent(next)}`);
      assert.ok([302, 307, 308].includes(r.status));
      assert.ok(!(r.headers.get("location") ?? "").includes("evil.example"), `redirecionou para ${next}`);
    }
  });
});

describe("verificador de produção", () => {
  test("o script verificar-producao passa contra este servidor (sem falhas)", async (t) => {
    if (pula(t)) return;
    let saida = "";
    try {
      saida = execFileSync("node", ["scripts/verificar-producao.mjs", BASE], { encoding: "utf8", cwd: new URL("../..", import.meta.url) });
    } catch (e) {
      assert.fail(`o verificador acusou falha:\n${e.stdout}`);
    }
    assert.match(saida, /0 falha\(s\)/);
  });
});

describe("áreas protegidas", () => {
  test("/painel e /admin sem login redirecionam para /login", async (t) => {
    if (pula(t)) return;
    for (const caminho of ["/painel", "/painel?aba=clientes", "/painel?aba=compartilhar", "/painel/exportar", "/admin", "/admin?aba=historico"]) {
      const r = await get(caminho);
      assert.ok([307, 308].includes(r.status), `${caminho} -> ${r.status}`);
      assert.match(r.headers.get("location") ?? "", /\/login/);
    }
  });

  test("parâmetro de aba malicioso não quebra nem vaza nada sem login", async (t) => {
    if (pula(t)) return;
    for (const aba of ["<script>", "../../etc", "%00", "'; drop table--"]) {
      const r = await get(`/painel?aba=${encodeURIComponent(aba)}`);
      assert.ok(r.status < 500, `aba ${aba} -> ${r.status}`);
    }
  });
});

describe("callback de login (open redirect)", () => {
  test("sem código volta ao login com erro", async (t) => {
    if (pula(t)) return;
    const r = await get("/auth/callback");
    assert.equal(r.headers.get("location"), `${BASE}/login?erro=link`);
  });

  test("código lixo + next apontando para site externo NÃO redireciona para fora", async (t) => {
    if (pula(t)) return;
    for (const next of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "http://evil.com/painel"]) {
      const r = await get(`/auth/callback?code=lixo&next=${encodeURIComponent(next)}`);
      const destino = r.headers.get("location") ?? "";
      assert.ok(destino.startsWith(BASE), `next=${next} -> ${destino}`);
      assert.ok(!destino.includes("evil.com"));
    }
  });
});

describe("XSS e vazamento de arquivos", () => {
  test("nome/descrição com HTML são escapados no perfil (sem </script> solto)", async (t) => {
    if (pula(t)) return;
    const html = await (await get(`/vendedores/${xss.vendedorId}`)).text();
    assert.ok(!html.includes("<img src=x onerror=alert(1)>"), "tag injetada apareceu crua");
    assert.ok(!html.includes("<script>alert('xss')</script>"), "script injetado apareceu cru");
    // o JSON-LD é o ponto mais sensível: não pode permitir fechar o <script> com </script>
    const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert.ok(ld, "bloco JSON-LD existe");
    assert.ok(!ld[1].includes("</script>") && !ld[1].includes("<img"), "JSON-LD escapou o '<'");
  });

  test("arquivos sensíveis e travessia de diretório devolvem 404", async (t) => {
    if (pula(t)) return;
    for (const caminho of [
      "/.env", "/.env.local", "/package.json", "/supabase/config.toml", "/src/lib/supabase/admin.ts",
      "/..%2f..%2f.env", "/%2e%2e/%2e%2e/.env", "/_next/../.env", "/.git/config", "/node_modules/next/package.json",
    ]) {
      const r = await get(caminho);
      assert.ok(r.status === 404 || r.status === 400 || r.status === 308, `${caminho} -> ${r.status}`);
      if (r.status === 200) assert.fail(`${caminho} respondeu 200`);
    }
  });

  test("a chave secreta não aparece em nenhuma página pública", async (t) => {
    if (pula(t)) return;
    const { cfg } = await import("../helpers.mjs");
    for (const caminho of ["/", "/sobre", "/contribuicao", "/login", `/vendedores/${aprovado.vendedorId}`]) {
      const html = await (await get(caminho)).text();
      assert.ok(!html.includes(cfg.sec), `${caminho} vazou a chave secreta`);
    }
  });
});

describe("cabeçalhos de segurança", () => {
  test("não anuncia a tecnologia e envia proteções básicas", async (t) => {
    if (pula(t)) return;
    const r = await get("/");
    assert.equal(r.headers.get("x-powered-by"), null);
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
    assert.equal(r.headers.get("x-frame-options"), "DENY");
    assert.match(r.headers.get("referrer-policy") ?? "", /strict-origin/);
  });

  test("CSP só relata (Report-Only), não bloqueia, e vale em todas as páginas", async (t) => {
    if (pula(t)) return;
    for (const caminho of ["/", "/sobre", "/feedback", "/login", "/termos"]) {
      const r = await get(caminho);
      const csp = r.headers.get("content-security-policy-report-only") ?? "";
      assert.ok(csp.includes("default-src 'self'"), `${caminho}: sem default-src`);
      assert.ok(csp.includes("frame-ancestors 'none'"), `${caminho}: sem frame-ancestors`);
      assert.ok(csp.includes("object-src 'none'"));
      assert.ok(csp.includes("report-uri /csp-report"));
      assert.equal(r.headers.get("content-security-policy"), null, `${caminho}: não pode bloquear ainda (modo de teste)`);
    }
  });

  test("/csp-report: aceita relatório válido, recusa lixo e tamanho exagerado, e não responde a GET", async (t) => {
    if (pula(t)) return;
    const enviar = (corpo, tipo = "application/csp-report") => get("/csp-report", { method: "POST", headers: { "content-type": tipo }, body: corpo });
    const valido = JSON.stringify({ "csp-report": { "document-uri": "https://s.com/", "effective-directive": "script-src", "blocked-uri": "inline" } });
    assert.equal((await enviar(valido)).status, 204);
    assert.equal((await enviar(JSON.stringify([{ type: "csp-violation", body: { effectiveDirective: "img-src", documentURL: "https://s.com/" } }]), "application/reports+json")).status, 204);
    assert.equal((await enviar("isso não é json")).status, 400);
    assert.equal((await enviar("{}")).status, 400);
    assert.equal((await enviar("null")).status, 400);
    assert.equal((await enviar("x".repeat(20 * 1024))).status, 413);
    assert.equal((await get("/csp-report")).status, 405);
  });

  test("/csp-report aguenta uma enxurrada de relatórios sem erro", async (t) => {
    if (pula(t)) return;
    const corpo = JSON.stringify({ "csp-report": { "document-uri": "https://s.com/", "effective-directive": "script-src", "blocked-uri": "inline" } });
    const r = await emLotes(150, 15, () => get("/csp-report", { method: "POST", headers: { "content-type": "application/csp-report" }, body: corpo }));
    assert.ok(r.every((x) => x.status === 204), "todas devem responder 204");
  });

  test("robots.txt esconde /painel, /admin e /login dos buscadores", async (t) => {
    if (pula(t)) return;
    const txt = await (await get("/robots.txt")).text();
    for (const rota of ["/painel", "/admin", "/login"]) assert.match(txt, new RegExp(`Disallow: ${rota}`));
  });

  test("sitemap lista o aprovado e NÃO lista o pendente", async (t) => {
    if (pula(t)) return;
    const xml = await (await get("/sitemap.xml")).text();
    assert.ok(xml.includes("/sobre") && xml.includes("/contribuicao"));
    assert.ok(!xml.includes("/catalogo"), "endereço antigo fora do sitemap");
    assert.ok(xml.includes(aprovado.vendedorId));
    assert.ok(!xml.includes(pendente.vendedorId));
  });
});

describe("Server Actions forjadas", () => {
  test("POST com Next-Action inventado devolve 4xx, não 500", async (t) => {
    if (pula(t)) return;
    for (const caminho of ["/login", "/painel", "/admin"]) {
      const r = await get(caminho, {
        method: "POST",
        headers: { "Next-Action": "0000000000000000000000000000000000000000", "content-type": "text/plain;charset=UTF-8" },
        body: "[]",
      });
      assert.ok(r.status < 500, `${caminho} -> ${r.status}`);
    }
  });

  test("POST com corpo gigante (5 MB) é recusado sem derrubar o servidor", async (t) => {
    if (pula(t)) return;
    const r = await get("/login", { method: "POST", headers: { "Next-Action": "00", "content-type": "text/plain" }, body: "x".repeat(5 * 1024 * 1024) });
    assert.ok(r.status < 500 || r.status === 413, `status ${r.status}`);
    assert.equal((await get("/robots.txt")).status, 200, "servidor continua respondendo");
  });

  test("métodos estranhos não geram 500", async (t) => {
    if (pula(t)) return;
    for (const metodo of ["PUT", "DELETE", "PATCH", "OPTIONS"]) {
      const r = await get("/catalogo", { method: metodo });
      assert.ok(r.status < 500, `${metodo} -> ${r.status}`);
    }
  });
});

describe("carga", () => {
  test("300 pedidos simultâneos à home e ao perfil: nenhum 5xx", async (t) => {
    if (pula(t)) return;
    const t0 = performance.now();
    const r = await emLotes(300, 30, (i) => get(i % 2 ? "/" : `/vendedores/${aprovado.vendedorId}`));
    const ruins = r.filter((x) => x.status >= 500).length;
    console.log(`   300 pedidos em ${Math.round(performance.now() - t0)}ms, 5xx=${ruins}`);
    await Promise.all(r.map((x) => x.arrayBuffer()));
    assert.equal(ruins, 0);
  });
});
