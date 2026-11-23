// Horário com dois períodos por dia, máscara de hora em 24 horas e "aberto agora" (sem banco, sem rede).

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { completarHora, mascararHora, normalizarHora, validarHorarios, validarExcecao } from "../../src/lib/validacao.ts";
import { estaAbertoAgora, situacaoAgora } from "../../src/lib/horarios.ts";

const erro = (r) => (r.ok ? null : r.erro);
const vazio = () => Array.from({ length: 7 }, () => [{ abre: "", fecha: "" }, { abre: "", fecha: "" }]);

describe("mascararHora (teclado numérico, 24 horas)", () => {
  const casos = [
    ["", ""],
    ["1", "1"],
    ["8", "08"], // primeiro dígito maior que 2 ganha o zero
    ["18", "18"],
    ["183", "18:3"],
    ["1830", "18:30"],
    ["18:30", "18:30"],
    ["183045", "18:30"], // sobra é ignorada
    ["2500", "23:00"], // hora acima de 23 vira 23
    ["1875", "18:07"], // minuto começando em 6 a 9 ganha o zero
    ["8:30", "08:30"],
    ["abc", ""],
    ["1 8 3 0", "18:30"],
    ["🍕", ""],
  ];
  for (const [entrada, esperado] of casos) {
    test(`${JSON.stringify(entrada)} -> ${JSON.stringify(esperado)}`, () => assert.equal(mascararHora(entrada), esperado));
  }

  test("o resultado nunca passa de 5 caracteres, mesmo com entrada enorme", () => {
    assert.ok(mascararHora("9".repeat(100000)).length <= 5);
  });
});

describe("completarHora (ao sair do campo)", () => {
  for (const [entrada, esperado] of [["", ""], ["8", "08:00"], ["18", "18:00"], ["18:3", "18:30"], ["18:30", "18:30"], ["x", ""]]) {
    test(`${JSON.stringify(entrada)} -> ${JSON.stringify(esperado)}`, () => assert.equal(completarHora(entrada), esperado));
  }
});

describe("normalizarHora", () => {
  test("aceita 8:00, 800 e 0800", () => {
    assert.equal(normalizarHora("8:00"), "08:00");
    assert.equal(normalizarHora("800"), "08:00");
    assert.equal(normalizarHora("0800"), "08:00");
    assert.equal(normalizarHora(" 18:30 "), "18:30");
  });
  test("só a hora ou minuto pela metade são completados", () => {
    assert.equal(normalizarHora("8"), "08:00");
    assert.equal(normalizarHora("18"), "18:00");
    assert.equal(normalizarHora("18:3"), "18:30");
    assert.equal(normalizarHora("25"), "25:00"); // continua inválido, a validação recusa
  });
  test("o que não parece hora volta como veio (a validação recusa)", () => {
    assert.equal(normalizarHora("oito"), "oito");
    assert.equal(normalizarHora("25:00"), "25:00");
  });
});

describe("validarHorarios com dois períodos", () => {
  test("manhã e noite no mesmo dia geram duas linhas", () => {
    const d = vazio();
    d[1] = [{ abre: "08:00", fecha: "12:00" }, { abre: "18:00", fecha: "22:00" }];
    const r = validarHorarios(d);
    assert.equal(r.ok, true);
    assert.deepEqual(r.valor, [
      { dia_semana: 1, abre: "08:00", fecha: "12:00" },
      { dia_semana: 1, abre: "18:00", fecha: "22:00" },
    ]);
  });

  test("o 2º período sozinho (1º em branco) também vale", () => {
    const d = vazio();
    d[2] = [{ abre: "", fecha: "" }, { abre: "18:00", fecha: "22:00" }];
    assert.equal(validarHorarios(d).valor.length, 1);
  });

  test("aceita horas digitadas sem os dois pontos ou sem o zero", () => {
    const d = vazio();
    d[3] = [{ abre: "800", fecha: "1200" }, { abre: "1800", fecha: "2200" }];
    assert.deepEqual(validarHorarios(d).valor.map((l) => [l.abre, l.fecha]), [["08:00", "12:00"], ["18:00", "22:00"]]);
  });

  test("a mensagem diz de qual período é o erro", () => {
    const d = vazio();
    d[1] = [{ abre: "08:00", fecha: "12:00" }, { abre: "18:00", fecha: "" }];
    assert.equal(erro(validarHorarios(d)), "Em segunda (2º período), falta a hora de fechar.");
  });

  test("com um período só, a mensagem não cita período (como antes)", () => {
    const d = vazio();
    d[1] = [{ abre: "08:00", fecha: "" }, { abre: "", fecha: "" }];
    assert.equal(erro(validarHorarios(d)), "Em segunda, falta a hora de fechar.");
  });

  for (const [nome, p, p2] of [
    ["períodos que se sobrepõem", ["08:00", "13:00"], ["12:00", "18:00"]],
    ["um período dentro do outro", ["08:00", "18:00"], ["10:00", "12:00"]],
    ["períodos iguais", ["08:00", "12:00"], ["08:00", "12:00"]],
    ["o 1º vira a noite e o 2º começa antes de ele acabar", ["18:00", "02:00"], ["22:00", "23:00"]],
  ]) {
    test(`recusa ${nome}`, () => {
      const d = vazio();
      d[4] = [{ abre: p[0], fecha: p[1] }, { abre: p2[0], fecha: p2[1] }];
      assert.match(erro(validarHorarios(d)), /Em quinta, os dois períodos se sobrepõem/);
    });
  }

  test("períodos encostados (12:00 e 12:00) não se sobrepõem", () => {
    const d = vazio();
    d[4] = [{ abre: "08:00", fecha: "12:00" }, { abre: "12:00", fecha: "18:00" }];
    assert.equal(validarHorarios(d).ok, true);
  });

  test("manhã e depois um turno que vira a noite é válido", () => {
    const d = vazio();
    d[5] = [{ abre: "08:00", fecha: "12:00" }, { abre: "18:00", fecha: "02:00" }];
    assert.equal(validarHorarios(d).ok, true);
  });

  test("a ordem digitada não importa (noite antes da manhã)", () => {
    const d = vazio();
    d[5] = [{ abre: "18:00", fecha: "22:00" }, { abre: "08:00", fecha: "12:00" }];
    assert.equal(validarHorarios(d).ok, true);
  });

  test("mais de dois períodos no dia são recusados", () => {
    const d = vazio();
    d[0] = [{ abre: "08:00", fecha: "10:00" }, { abre: "11:00", fecha: "13:00" }, { abre: "18:00", fecha: "22:00" }];
    assert.equal(erro(validarHorarios(d)), "Em domingo, use no máximo 2 períodos.");
  });

  test("continua aceitando um objeto por dia (formato antigo)", () => {
    const d = Array.from({ length: 7 }, () => ({ abre: "", fecha: "" }));
    d[1] = { abre: "08:00", fecha: "18:00" };
    assert.equal(validarHorarios(d).valor.length, 1);
  });
});

describe("data especial aceita horas sem os dois pontos", () => {
  test("800 e 1200 viram 08:00 e 12:00", () => {
    const r = validarExcecao({ data: "2031-05-05", fechado: false, abre: "800", fecha: "1200", motivo: "" }, "2031-01-01");
    assert.deepEqual([r.valor.abre, r.valor.fecha], ["08:00", "12:00"]);
  });
});

describe("aberto agora com dois períodos", () => {
  // segunda-feira, 6 de outubro de 2031 (horário de Brasília = UTC-3)
  const em = (hhmm) => new Date(`2031-10-06T${hhmm}:00-03:00`);
  const h = (dia, abre, fecha) => ({ id: `${dia}${abre}`, vendedor_id: "v", dia_semana: dia, abre: `${abre}:00`, fecha: `${fecha}:00` });
  const segunda = [h(1, "08:00", "12:00"), h(1, "18:00", "22:00")];

  for (const [hora, esperado] of [
    ["07:59", false],
    ["08:00", true],
    ["11:59", true],
    ["12:00", false],
    ["15:00", false], // entre os dois períodos
    ["17:59", false],
    ["18:00", true],
    ["21:59", true],
    ["22:00", false],
  ]) {
    test(`segunda às ${hora}: ${esperado ? "aberto" : "fechado"}`, () => assert.equal(estaAbertoAgora(segunda, em(hora)), esperado));
  }

  test("a ordem em que os períodos chegam do banco não importa", () => {
    assert.equal(estaAbertoAgora([...segunda].reverse(), em("19:00")), true);
  });

  test("turno da noite que vira o dia: terça de madrugada ainda vale o de segunda", () => {
    const noite = [h(1, "08:00", "12:00"), h(1, "18:00", "02:00")];
    assert.equal(estaAbertoAgora(noite, new Date("2031-10-07T01:00:00-03:00")), true);
    assert.equal(estaAbertoAgora(noite, new Date("2031-10-07T03:00:00-03:00")), false);
  });

  test("situacaoAgora usa os dois períodos", () => {
    const v = { horarios: segunda, excecoes: [], status_manual: "normal", status_manual_ate: null, status_manual_msg: null };
    assert.equal(situacaoAgora(v, em("19:00")).aberto, true);
    assert.equal(situacaoAgora(v, em("15:00")).rotulo, "Fechado agora");
  });
});
