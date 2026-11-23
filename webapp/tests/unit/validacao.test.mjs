// Testes das regras de validação e máscaras (sem banco, sem rede).
// Cada caso confere o TEXTO da mensagem: ela precisa dizer ao usuário o que
// corrigir, e não só "inválido".

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  BAIRRO_OUTRO,
  lerPreco,
  mascararWhatsApp,
  normalizarWhatsApp,
  somarDias,
  validarCadastro,
  validarCategoriaProduto,
  validarExcecao,
  validarFeedback,
  validarHorarios,
  validarItem,
  validarLogin,
  validarPerfil,
  validarStatus,
} from "../../src/lib/validacao.ts";

const HOJE = "2026-10-02";
const erro = (r) => (r.ok ? null : r.erro);

describe("máscara do WhatsApp", () => {
  const casos = [
    ["", ""],
    ["1", "(1"],
    ["11", "(11"],
    ["119", "(11) 9"],
    ["1199999", "(11) 9999-9"],
    ["1133334444", "(11) 3333-4444"],
    ["11999990000", "(11) 99999-0000"],
    ["(11) 99999-0000", "(11) 99999-0000"],
    ["+55 11 99999-0000", "(11) 99999-0000"],
    ["5511999990000", "(11) 99999-0000"],
    ["abc", ""],
    ["11a9b9c9d9e9f0g0h0i0", "(11) 99999-0000"],
    ["119999900001234567", "(11) 99999-0000"], // sobra é cortada
    ["   ", ""],
    ["💥11999990000💥", "(11) 99999-0000"],
  ];
  for (const [entrada, esperado] of casos) {
    test(`${JSON.stringify(entrada)} -> ${JSON.stringify(esperado)}`, () => {
      assert.equal(mascararWhatsApp(entrada), esperado);
    });
  }

  test("a máscara é idempotente (mascarar de novo não muda)", () => {
    for (const [entrada] of casos) {
      const uma = mascararWhatsApp(entrada);
      assert.equal(mascararWhatsApp(uma), uma);
    }
  });
});

describe("normalização do WhatsApp", () => {
  test("aceita celular e fixo, com ou sem 55", () => {
    assert.equal(normalizarWhatsApp("(11) 99999-0000"), "5511999990000");
    assert.equal(normalizarWhatsApp("11 3333-4444"), "551133334444");
    assert.equal(normalizarWhatsApp("+55 (21) 98888-7777"), "5521988887777");
  });
  for (const ruim of ["", "abc", "123", "999999999", "(00) 99999-0000", "(10) 99999-0000", "551199999000011", "11 99999-00001"]) {
    test(`recusa ${JSON.stringify(ruim)}`, () => assert.equal(normalizarWhatsApp(ruim), null));
  }
});

describe("preço", () => {
  const validos = [
    ["", null],
    ["   ", null],
    ["0", 0],
    ["25", 25],
    ["25,9", 25.9],
    ["25,90", 25.9],
    ["25.90", 25.9],
    ["1.250,00", 1250],
    ["1250", 1250],
    ["R$ 10", 10],
    ["R$10,50", 10.5],
    ["99999", 99999],
  ];
  for (const [entrada, esperado] of validos) {
    test(`aceita ${JSON.stringify(entrada)}`, () => assert.equal(lerPreco(entrada), esperado));
  }
  const invalidos = ["abc", "-5", "1e3", "100000", "10,999", "1,2,3", "NaN", "Infinity", "0x10", "12a", "10,", ",50", "1..000,00", "R$", "99.999,99", "💰", "1 000"];
  for (const entrada of invalidos) {
    test(`recusa ${JSON.stringify(entrada)}`, () => assert.equal(lerPreco(entrada), "invalido"));
  }
});

describe("cadastro de conta", () => {
  const ok = { email: "ze@exemplo.com", username: "pizzaria.do.ze", senha: "senhaboa123", categoriaIds: ["c1"], aceitouTermos: true };

  test("dados corretos passam e são normalizados", () => {
    const r = validarCadastro({ ...ok, email: "  ZE@Exemplo.COM ", username: "  Pizzaria.Do.Ze " });
    assert.deepEqual(r, { ok: true, valor: { email: "ze@exemplo.com", username: "pizzaria.do.ze" } });
  });

  const casos = [
    ["e-mail vazio", { email: "" }, "Digite seu e-mail."],
    ["e-mail sem @", { email: "zeexemplo.com" }, "E-mail inválido. Use o formato nome@email.com."],
    ["e-mail sem domínio", { email: "ze@" }, "E-mail inválido. Use o formato nome@email.com."],
    ["e-mail com espaço", { email: "z e@exemplo.com" }, "E-mail inválido. Use o formato nome@email.com."],
    ["e-mail gigante", { email: `${"a".repeat(250)}@x.com` }, "E-mail inválido. Use o formato nome@email.com."],
    ["usuário vazio", { username: "" }, "Escolha um nome de usuário."],
    ["usuário curto", { username: "ab" }, "Usuário: de 3 a 30 caracteres, só letras minúsculas, números, ponto (.) e sublinhado (_). Sem espaços."],
    ["usuário com espaço", { username: "pizza do ze" }, "Usuário: de 3 a 30 caracteres, só letras minúsculas, números, ponto (.) e sublinhado (_). Sem espaços."],
    ["usuário com acento", { username: "zé" }, "Usuário: de 3 a 30 caracteres, só letras minúsculas, números, ponto (.) e sublinhado (_). Sem espaços."],
    ["usuário com @", { username: "ze@casa" }, "Usuário: de 3 a 30 caracteres, só letras minúsculas, números, ponto (.) e sublinhado (_). Sem espaços."],
    ["usuário gigante", { username: "a".repeat(31) }, "Usuário: de 3 a 30 caracteres, só letras minúsculas, números, ponto (.) e sublinhado (_). Sem espaços."],
    ["usuário com injeção SQL", { username: "x'; drop table vendedores;--" }, "Usuário: de 3 a 30 caracteres, só letras minúsculas, números, ponto (.) e sublinhado (_). Sem espaços."],
    ["senha curta", { senha: "1234567" }, "A senha precisa ter pelo menos 8 caracteres."],
    ["senha vazia", { senha: "" }, "A senha precisa ter pelo menos 8 caracteres."],
    ["senha enorme", { senha: "a".repeat(73) }, "A senha pode ter no máximo 72 caracteres."],
    ["senha igual ao usuário", { username: "pizzaria123", senha: "PIZZARIA123" }, "A senha não pode ser igual ao usuário."],
    ["sem ramo", { categoriaIds: [] }, "Escolha pelo menos um ramo do seu negócio."],
  ];
  for (const [nome, parcial, mensagem] of casos) {
    test(nome, () => assert.equal(erro(validarCadastro({ ...ok, ...parcial })), mensagem));
  }
});

describe("login", () => {
  test("campos vazios dizem o que falta", () => {
    assert.equal(validarLogin("", "x"), "Digite seu usuário ou e-mail.");
    assert.equal(validarLogin("   ", "x"), "Digite seu usuário ou e-mail.");
    assert.equal(validarLogin("ze", ""), "Digite sua senha.");
  });
  test("entrada absurda recebe a mesma mensagem genérica (não revela nada)", () => {
    assert.equal(validarLogin("a".repeat(300), "x"), "Usuário/e-mail ou senha incorretos.");
    assert.equal(validarLogin("ze", "x".repeat(100)), "Usuário/e-mail ou senha incorretos.");
  });
  test("entrada normal passa", () => assert.equal(validarLogin("ze", "qualquer"), null));
});

describe("perfil", () => {
  const ok = {
    nome: "Lanchonete do Zé",
    descricao: "Lanches artesanais",
    whatsapp: "(11) 99999-0000",
    modo: "ambos",
    bairroId: "b1",
    categoriaIds: ["c1"],
  };

  test("dados corretos passam e o WhatsApp vira só dígitos com 55", () => {
    const r = validarPerfil(ok);
    assert.equal(r.ok, true);
    assert.equal(r.valor.whatsapp, "5511999990000");
    assert.equal(r.valor.descricao, "Lanches artesanais");
  });

  test("descrição vazia vira null", () => assert.equal(validarPerfil({ ...ok, descricao: "  " }).valor.descricao, null));

  const casos = [
    ["nome vazio", { nome: "  " }, "Digite o nome do seu negócio."],
    ["nome de 1 letra", { nome: "Z" }, "O nome precisa ter pelo menos 2 letras."],
    ["nome de 61", { nome: "a".repeat(61) }, "O nome pode ter no máximo 60 caracteres (agora tem 61)."],
    ["descrição de 301", { descricao: "a".repeat(301) }, "A descrição pode ter no máximo 300 caracteres (agora tem 301)."],
    ["WhatsApp vazio", { whatsapp: "" }, "Digite o WhatsApp com DDD, por exemplo (11) 99999-0000."],
    ["WhatsApp só letras", { whatsapp: "abc" }, "Digite o WhatsApp com DDD, por exemplo (11) 99999-0000."],
    ["WhatsApp curto", { whatsapp: "99999" }, "WhatsApp inválido. Digite o DDD e o número, por exemplo (11) 99999-0000."],
    ["WhatsApp com DDD inexistente", { whatsapp: "(05) 99999-0000" }, "WhatsApp inválido. Digite o DDD e o número, por exemplo (11) 99999-0000."],
    ["modo inventado", { modo: "drone" }, "Escolha como vocês atendem: entrega, retirada ou os dois."],
    ["sem bairro", { bairroId: "" }, "Escolha o bairro."],
    ["sem ramo", { categoriaIds: [] }, "Marque pelo menos um ramo."],
  ];
  for (const [nome, parcial, mensagem] of casos) {
    test(nome, () => assert.equal(erro(validarPerfil({ ...ok, ...parcial })), mensagem));
  }

  test("a mensagem de tamanho conta caracteres, não bytes (emoji)", () => {
    assert.equal(validarPerfil({ ...ok, nome: "🍕".repeat(30) }).ok, true);
  });
});

describe("horário semanal", () => {
  const vazio = () => Array.from({ length: 7 }, () => ({ abre: "", fecha: "" }));

  test("tudo em branco é válido (nunca abre)", () => assert.deepEqual(validarHorarios(vazio()), { ok: true, valor: [] }));

  test("dia completo passa", () => {
    const d = vazio();
    d[1] = { abre: "08:00", fecha: "18:00" };
    d[5] = { abre: "18:00", fecha: "02:00" }; // vira a noite
    const r = validarHorarios(d);
    assert.equal(r.ok, true);
    assert.equal(r.valor.length, 2);
  });

  const casos = [
    ["falta fechar", { abre: "08:00", fecha: "" }, "Em segunda, falta a hora de fechar."],
    ["falta abrir", { abre: "", fecha: "18:00" }, "Em segunda, falta a hora de abrir."],
    ["hora 25", { abre: "25:00", fecha: "18:00" }, "Em segunda, use horas no formato 18:30."],
    ["minuto 60", { abre: "08:60", fecha: "18:00" }, "Em segunda, use horas no formato 18:30."],
    ["texto", { abre: "oito", fecha: "dezoito" }, "Em segunda, use horas no formato 18:30."],
    ["abre = fecha", { abre: "08:00", fecha: "08:00" }, "Em segunda, abrir e fechar não podem ser no mesmo horário."],
  ];
  for (const [nome, dia, mensagem] of casos) {
    test(nome, () => {
      const d = vazio();
      d[1] = dia;
      assert.equal(erro(validarHorarios(d)), mensagem);
    });
  }

  test("a mensagem cita o dia certo", () => {
    const d = vazio();
    d[6] = { abre: "08:00", fecha: "" };
    assert.equal(erro(validarHorarios(d)), "Em sábado, falta a hora de fechar.");
  });
});

describe("data especial", () => {
  const ok = { data: "2026-12-25", fechado: true, abre: "", fecha: "", motivo: "Natal" };

  test("fechado o dia todo passa e zera as horas", () => {
    const r = validarExcecao({ ...ok, abre: "08:00", fecha: "12:00" }, HOJE);
    assert.deepEqual(r.valor, { data: "2026-12-25", fechado: true, abre: null, fecha: null, motivo: "Natal" });
  });
  test("hoje é permitido", () => assert.equal(validarExcecao({ ...ok, data: HOJE }, HOJE).ok, true));
  test("com horário próprio passa", () =>
    assert.equal(validarExcecao({ ...ok, fechado: false, abre: "10:00", fecha: "14:00" }, HOJE).ok, true));

  const casos = [
    ["sem data", { data: "" }, "Escolha a data."],
    ["data impossível (30/02)", { data: "2026-02-30" }, "Data inválida. Escolha no calendário."],
    ["data em texto", { data: "amanhã" }, "Data inválida. Escolha no calendário."],
    ["data no passado", { data: "2026-10-01" }, "A data não pode ser no passado."],
    ["mais de 1 ano", { data: "2027-10-03" }, "Escolha uma data dentro do próximo ano."],
    ["motivo longo", { motivo: "a".repeat(101) }, "O motivo pode ter no máximo 100 caracteres (agora tem 101)."],
    ["aberto sem horas", { fechado: false }, "Informe a hora de abrir e a de fechar, ou marque “Fechado o dia todo”."],
    ["aberto com só uma hora", { fechado: false, abre: "10:00" }, "Informe a hora de abrir e a de fechar, ou marque “Fechado o dia todo”."],
    ["hora inválida", { fechado: false, abre: "99:99", fecha: "10:00" }, "Use horas no formato 18:30."],
    ["abre = fecha", { fechado: false, abre: "10:00", fecha: "10:00" }, "Abrir e fechar não podem ser no mesmo horário."],
  ];
  for (const [nome, parcial, mensagem] of casos) {
    test(nome, () => assert.equal(erro(validarExcecao({ ...ok, ...parcial }, HOJE)), mensagem));
  }

  test("somarDias atravessa mês e ano", () => {
    assert.equal(somarDias("2026-12-31", 1), "2027-01-01");
    assert.equal(somarDias("2028-02-28", 1), "2028-02-29");
  });
});

describe("aviso de férias / não abro hoje", () => {
  test("não abro hoje vale só para hoje", () => {
    const r = validarStatus({ status: "fechado_hoje", ate: "2030-01-01", msg: "Volto amanhã" }, HOJE);
    assert.equal(r.valor.status_manual_ate, HOJE);
  });
  test("férias sem data de volta é permitido", () => {
    assert.equal(validarStatus({ status: "ferias", ate: "", msg: "" }, HOJE).valor.status_manual_ate, null);
  });
  test("voltar ao normal limpa mensagem e data", () => {
    const r = validarStatus({ status: "normal", ate: "2026-12-01", msg: "lixo" }, HOJE);
    assert.deepEqual(r.valor, { status_manual: "normal", status_manual_ate: null, status_manual_msg: null });
  });

  const casos = [
    ["opção inventada", { status: "greve", ate: "", msg: "" }, "Escolha uma das opções."],
    ["mensagem longa", { status: "ferias", ate: "", msg: "a".repeat(141) }, "A mensagem pode ter no máximo 140 caracteres (agora tem 141)."],
    ["volta no passado", { status: "ferias", ate: "2026-10-01", msg: "" }, "A data de volta não pode ser no passado."],
    ["volta impossível", { status: "ferias", ate: "2026-13-45", msg: "" }, "Data de volta inválida. Escolha no calendário."],
    ["volta daqui a 2 anos", { status: "ferias", ate: "2028-10-02", msg: "" }, "Escolha uma data de volta dentro do próximo ano."],
  ];
  for (const [nome, entrada, mensagem] of casos) {
    test(nome, () => assert.equal(erro(validarStatus(entrada, HOJE)), mensagem));
  }
});

describe("item do menu", () => {
  test("item completo passa", () => {
    const r = validarItem({ nome: " X-Burguer ", descricao: "Pão e carne", preco: "25,90" });
    assert.deepEqual(r.valor, { nome: "X-Burguer", descricao: "Pão e carne", preco: 25.9 });
  });
  test("preço e descrição são opcionais", () => {
    assert.deepEqual(validarItem({ nome: "Fiado", descricao: "", preco: "" }).valor, { nome: "Fiado", descricao: null, preco: null });
  });

  const casos = [
    ["nome vazio", { nome: "  ", descricao: "", preco: "" }, "Digite o nome do item."],
    ["nome longo", { nome: "a".repeat(81), descricao: "", preco: "" }, "O nome do item pode ter no máximo 80 caracteres (agora tem 81)."],
    ["descrição longa", { nome: "x", descricao: "a".repeat(201), preco: "" }, "A descrição pode ter no máximo 200 caracteres (agora tem 201)."],
    ["preço em letras", { nome: "x", descricao: "", preco: "dez reais" }, "Preço inválido. Use números, por exemplo 25,90 (máximo 99.999)."],
    ["preço negativo", { nome: "x", descricao: "", preco: "-1" }, "Preço inválido. Use números, por exemplo 25,90 (máximo 99.999)."],
    ["preço enorme", { nome: "x", descricao: "", preco: "1000000" }, "Preço inválido. Use números, por exemplo 25,90 (máximo 99.999)."],
  ];
  for (const [nome, entrada, mensagem] of casos) {
    test(nome, () => assert.equal(erro(validarItem(entrada)), mensagem));
  }

  test("texto com HTML/SQL é aceito como texto puro (a tela escapa; o banco usa parâmetros)", () => {
    const r = validarItem({ nome: "<script>alert(1)</script>", descricao: "'; drop table itens_cardapio;--", preco: "" });
    assert.equal(r.ok, true);
    assert.equal(r.valor.nome, "<script>alert(1)</script>");
  });
});

describe("robustez: nenhuma entrada estranha derruba a validação", () => {
  const estranhas = ["", " ", "\n\t", "\0", "null", "undefined", "{}", "[]", "0".repeat(100000), "💥".repeat(5000), "‮\u0000", "a\r\nb"];
  for (const e of estranhas) {
    test(`entrada ${JSON.stringify(e.slice(0, 20))} (${e.length} chars)`, () => {
      assert.doesNotThrow(() => {
        validarPerfil({ nome: e, descricao: e, whatsapp: e, modo: e, bairroId: e, categoriaIds: [] });
        validarCadastro({ email: e, username: e, senha: e, categoriaIds: [], aceitouTermos: false });
        validarItem({ nome: e, descricao: e, preco: e });
        validarExcecao({ data: e, fechado: false, abre: e, fecha: e, motivo: e }, HOJE);
        validarStatus({ status: e, ate: e, msg: e }, HOJE);
        validarHorarios([{ abre: e, fecha: e }]);
        mascararWhatsApp(e);
        normalizarWhatsApp(e);
        lerPreco(e);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Fale conosco
// ---------------------------------------------------------------------------

describe("validarFeedback", () => {
  const ok = { tipo: "problema", mensagem: "O botão de salvar não responde", pagina: "/painel", contato: "" };

  test("aceita uma mensagem válida e normaliza vazios para null", () => {
    const r = validarFeedback(ok);
    assert.equal(r.ok, true);
    assert.deepEqual(r.valor, { tipo: "problema", mensagem: "O botão de salvar não responde", pagina: "/painel", contato: null });
  });

  test("recusa tipo desconhecido com mensagem clara", () => {
    const r = validarFeedback({ ...ok, tipo: "xablau" });
    assert.equal(r.ok, false);
    assert.match(r.erro, /problema, sugestão ou dúvida/);
  });

  test("mensagem curta diz quantos caracteres tem", () => {
    const r = validarFeedback({ ...ok, mensagem: "  oi  " });
    assert.match(r.erro, /pelo menos 10 caracteres \(agora tem 2\)/);
  });

  test("mensagem longa e contato longo", () => {
    assert.match(validarFeedback({ ...ok, mensagem: "a".repeat(1001) }).erro, /no máximo 1000/);
    assert.match(validarFeedback({ ...ok, contato: "a".repeat(101) }).erro, /no máximo 100/);
  });

  test("recusa página longa demais", () => {
    assert.match(validarFeedback({ ...ok, pagina: "/" + "a".repeat(200) }).erro, /200 caracteres/);
  });
});

describe("validarPerfil: bairro novo (Não achei meu bairro)", () => {
  const base = { nome: "Lanchonete", descricao: "", whatsapp: "11999990000", modo: "ambos", bairroId: "b1", categoriaIds: ["c1"] };

  test("bairro da lista: devolve o id e nada de sugestão", () => {
    const r = validarPerfil(base);
    assert.equal(r.ok, true);
    assert.equal(r.valor.bairro_id, "b1");
    assert.equal("bairro_novo" in r.valor, false);
  });
  test("opção 'Não achei': devolve só o nome sugerido, limpo, sem id de bairro", () => {
    const r = validarPerfil({ ...base, bairroId: BAIRRO_OUTRO, bairroNovo: "  Vila   Nova  " });
    assert.equal(r.ok, true);
    assert.equal(r.valor.bairro_novo, "Vila Nova");
    assert.equal("bairro_id" in r.valor, false);
  });
  test("sem bairro escolhido, mas com nome digitado: também é sugestão", () => {
    const r = validarPerfil({ ...base, bairroId: "", bairroNovo: "Vila Nova" });
    assert.equal(r.valor.bairro_novo, "Vila Nova");
  });
  test("o bairro da lista vence o texto solto que sobrou no campo", () => {
    const r = validarPerfil({ ...base, bairroNovo: "Vila Nova" });
    assert.equal(r.valor.bairro_id, "b1");
    assert.equal("bairro_novo" in r.valor, false);
  });
  test("'Não achei' sem digitar o nome: pede o nome", () => {
    assert.match(erro(validarPerfil({ ...base, bairroId: BAIRRO_OUTRO, bairroNovo: "  " })), /Digite o nome do bairro/);
  });
  test("nome de bairro muito curto ou longo é recusado", () => {
    assert.match(erro(validarPerfil({ ...base, bairroId: BAIRRO_OUTRO, bairroNovo: "a" })), /pelo menos 2 letras/);
    assert.match(erro(validarPerfil({ ...base, bairroId: BAIRRO_OUTRO, bairroNovo: "x".repeat(61) })), /no máximo 60/);
  });
  test("sem bairro nenhum continua pedindo para escolher", () => {
    assert.equal(validarPerfil({ ...base, bairroId: "" }).erro, "Escolha o bairro.");
  });
});

describe("validarCategoriaProduto", () => {
  const erro = (r) => (r.ok ? null : r.erro);
  test("nome limpo", () => {
    assert.deepEqual(validarCategoriaProduto("  Cachorro   quente "), { ok: true, valor: "Cachorro quente" });
    assert.equal(validarCategoriaProduto("Açaí").valor, "Açaí");
    assert.equal(validarCategoriaProduto("Xis").ok, true);
  });
  test("vazio, curto e longo", () => {
    assert.match(erro(validarCategoriaProduto("  ")), /Digite o nome da categoria/);
    assert.match(erro(validarCategoriaProduto("a")), /pelo menos 2 letras/);
    assert.equal(validarCategoriaProduto("x".repeat(30)).ok, true);
    assert.match(erro(validarCategoriaProduto("x".repeat(31))), /no máximo 30 caracteres \(agora tem 31\)/);
  });
  test("sem letras, com site ou e-mail", () => {
    assert.match(erro(validarCategoriaProduto("!!!")), /Use letras/);
    assert.match(erro(validarCategoriaProduto("www.loja.com")), /sem site nem e-mail/);
    assert.match(erro(validarCategoriaProduto("ana@x.com")), /sem site nem e-mail/);
    assert.match(erro(validarCategoriaProduto("https://x")), /sem site nem e-mail/);
  });
  test("caracteres de controle e entradas hostis viram texto limpo ou erro, sem quebrar", () => {
    assert.equal(validarCategoriaProduto("Be\u0000bi\u0007das").valor, "Be bi das");
    for (const h of ["' or 1=1 --", "<script>", "💥".repeat(5), "a".repeat(100000)]) assert.doesNotThrow(() => validarCategoriaProduto(h));
  });
});
