# Política de segurança

Obrigado por querer deixar o Sabor Local mais seguro.

## Como avisar sobre uma falha

**Não abra uma issue pública** para vulnerabilidades. Use um destes canais:

1. **Relato privado no GitHub (preferido):** aba **Security** do repositório → **Report a vulnerability**.
2. **E-mail:** o contato fica em `/.well-known/security.txt` do site em produção (definido pela variável
   `NEXT_PUBLIC_CONTATO_EMAIL`).

Inclua, se puder: onde está o problema, como reproduzir (passo a passo), o impacto que você imagina e a versão ou data
em que testou. Não é preciso saber corrigir.

## O que esperar

- Resposta inicial em **até 7 dias**.
- Aviso quando a correção estiver pronta, e crédito a quem avisou, se a pessoa quiser.
- Por favor, **não divulgue** o problema antes da correção.

## O que vale testar (e o que não)

- Pode: testar no seu próprio ambiente local (`docs/` explica como subir tudo em um comando) e ler o código.
- Não faça: ataque de negação de serviço, testes de força bruta ou carga contra o ambiente de produção, spam em
  formulários, acesso a dados de outras pessoas ou engenharia social contra a equipe e os vendedores.

## O que já está coberto

A revisão de segurança, os limites contra abuso e os pontos que ainda estão em aberto estão em
[docs/seguranca.md](docs/seguranca.md).
