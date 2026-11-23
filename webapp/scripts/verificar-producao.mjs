// Verificação de saúde de um site publicado (ou local). SOMENTE LEITURA: faz poucas requisições GET
// comuns, sem ataque, sem criar nada. Pode rodar contra produção.
//
//   npm run verificar:producao -- https://seu-site.vercel.app
//   npm run verificar:producao -- http://localhost:3055
//
// Saída: OK / AVISO (confira) / FALHA (corrigir antes de divulgar). Código de saída 1 se houver FALHA.
//
// Os testes de força bruta (tests/forca-bruta) NÃO devem ser apontados para produção; use este script.

const base = (process.argv[2] ?? "").replace(/\/$/, "");
if (!/^https?:\/\//.test(base)) {
  console.error("Uso: node scripts/verificar-producao.mjs https://seu-site.com");
  process.exit(2);
}

const url = new URL(base);
const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
const resultados = [];
const registrar = (nivel, nome, detalhe = "") => {
  resultados.push({ nivel, nome });
  const marca = { OK: "OK    ", AVISO: "AVISO ", FALHA: "FALHA " }[nivel];
  console.log(`${marca}${nome}${detalhe ? `  (${detalhe})` : ""}`);
};
const ok = (nome, detalhe) => registrar("OK", nome, detalhe);
const falha = (nome, detalhe) => registrar("FALHA", nome, detalhe);
const confere = (condicao, nome, detalhe, nivelSeFalhar = "FALHA") =>
  condicao ? ok(nome) : registrar(nivelSeFalhar, nome, detalhe);

const get = (caminho, opcoes = {}) =>
  fetch(`${base}${caminho}`, { redirect: "manual", signal: AbortSignal.timeout(15000), ...opcoes });

async function tentar(nome, fn) {
  try {
    await fn();
  } catch (e) {
    falha(nome, `erro de rede: ${e.cause?.code ?? e.message}`);
  }
}

console.log(`\nVerificando ${base}\n`);

// ---- 1. Transporte e páginas
await tentar("conexão", async () => {
  if (!local) confere(url.protocol === "https:", "Site usa HTTPS", "use https:// em produção");
  for (const caminho of ["/", "/sobre", "/contribuicao", "/termos", "/privacidade", "/login"]) {
    const r = await get(caminho);
    confere(r.status === 200, `GET ${caminho} responde 200`, `status ${r.status}`);
  }
});

// ---- 2. Áreas protegidas e redirecionamentos
await tentar("redirecionamentos", async () => {
  for (const caminho of ["/painel", "/admin"]) {
    const r = await get(caminho);
    const destino = r.headers.get("location") ?? "";
    confere([307, 308].includes(r.status) && destino.includes("/login"), `${caminho} sem login vai para /login`, `status ${r.status} → ${destino}`);
  }
  const antigo = await get("/catalogo");
  confere([301, 307, 308].includes(antigo.status) && new URL(antigo.headers.get("location") ?? "/", base).pathname === "/", "/catalogo redireciona para a home", `status ${antigo.status}`);

  const cb = await get("/auth/callback?code=x&next=" + encodeURIComponent("//evil.example"));
  const destinoCb = cb.headers.get("location") ?? "";
  confere(!destinoCb.includes("evil.example"), "Callback de login não redireciona para site externo", destinoCb);
});

// ---- 3. Cabeçalhos de segurança
await tentar("cabeçalhos", async () => {
  const r = await get("/");
  confere(r.headers.get("x-powered-by") === null, "Não anuncia a tecnologia (X-Powered-By)", r.headers.get("x-powered-by") ?? "");
  confere(r.headers.get("x-content-type-options") === "nosniff", "X-Content-Type-Options: nosniff");
  confere(r.headers.get("x-frame-options") === "DENY", "X-Frame-Options: DENY");
  confere(/strict-origin/.test(r.headers.get("referrer-policy") ?? ""), "Referrer-Policy definido");
  if (!local) confere(Boolean(r.headers.get("strict-transport-security")), "HSTS ativo", "a Vercel costuma ativar sozinha em HTTPS", "AVISO");
});

// ---- 4. SEO: robots e sitemap apontam para o endereço público (pega NEXT_PUBLIC_SITE_URL esquecida)
await tentar("seo", async () => {
  const robots = await (await get("/robots.txt")).text();
  for (const rota of ["/painel", "/admin", "/login"]) {
    confere(new RegExp(`Disallow: ${rota}`).test(robots), `robots.txt esconde ${rota}`);
  }
  const mapaDeclarado = robots.match(/Sitemap:\s*(\S+)/)?.[1] ?? "";
  if (local) {
    ok("robots.txt declara o sitemap", mapaDeclarado);
  } else {
    confere(
      mapaDeclarado.startsWith(base) && !mapaDeclarado.includes("localhost"),
      "robots.txt aponta o sitemap para o site publicado",
      `${mapaDeclarado || "sem Sitemap"} (defina NEXT_PUBLIC_SITE_URL na Vercel)`,
    );
  }
  const sitemap = await (await get("/sitemap.xml")).text();
  confere(sitemap.includes("<urlset"), "sitemap.xml é um XML válido");
  if (!local) confere(!sitemap.includes("localhost"), "sitemap.xml sem endereço de localhost", "defina NEXT_PUBLIC_SITE_URL na Vercel");
});

// ---- 5. Vazamento de segredos e arquivos
await tentar("segredos", async () => {
  for (const caminho of ["/", "/login", "/termos"]) {
    const html = await (await get(caminho)).text();
    confere(!/sb_secret_|service_role/.test(html), `${caminho} não expõe chave secreta`);
  }
  for (const caminho of ["/.env", "/.env.local", "/package.json", "/supabase/config.toml", "/.git/config"]) {
    const r = await get(caminho);
    confere(r.status === 404, `${caminho} não é servido`, `status ${r.status}`);
  }
});

// ---- 6. Dados e configuração
await tentar("conteudo", async () => {
  const home = await (await get("/")).text();
  confere(/Todos os vendedores|encontrado/.test(home), "Home carrega o catálogo (conexão com o Supabase)");
  const vazio = /0 vendedores encontrado/.test(home);
  confere(!vazio, "Catálogo tem vendedores", "nenhum vendedor aprovado ainda", "AVISO");

  const privacidade = await (await get("/privacidade")).text();
  const temContato = /mailto:|wa\.me\//.test(privacidade);
  confere(
    temContato,
    "Política de Privacidade tem e-mail ou WhatsApp de contato",
    "defina NEXT_PUBLIC_CONTATO_EMAIL (e NEXT_PUBLIC_RESPONSAVEL_NOME) na Vercel",
    "AVISO",
  );
});

const falhas = resultados.filter((r) => r.nivel === "FALHA").length;
const avisos = resultados.filter((r) => r.nivel === "AVISO").length;
console.log(`\n${resultados.length - falhas - avisos} ok, ${avisos} aviso(s), ${falhas} falha(s)\n`);
process.exit(falhas > 0 ? 1 : 0);
