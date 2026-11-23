import type { Metadata } from "next";
import Link from "next/link";
import { PaginaLegal } from "@/components/PaginaLegal";
import { responsavel } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Quais dados o Sabor Local coleta, para quê, por quanto tempo e como você exerce seus direitos (LGPD).",
};

export default function PrivacidadePage() {
  const r = responsavel();

  return (
    <PaginaLegal titulo="Política de Privacidade">
      <p>
        Esta política explica, em linguagem simples, quais dados o Sabor Local coleta, para que servem, por quanto
        tempo ficam guardados e como você pode controlá-los, conforme a Lei Geral de Proteção de Dados (LGPD, Lei
        13.709/2018).
      </p>

      <section>
        <h2>1. Quem é o responsável</h2>
        <p>
          O responsável pelo tratamento dos dados (controlador) é <strong>{r.nome}</strong>. Para falar sobre dados
          pessoais:{" "}
          {r.email ? (
            <a href={`mailto:${r.email}`} className="text-orange-600 underline">
              {r.email}
            </a>
          ) : null}
          {r.email && (r.whatsapp || r.github) ? " · " : null}
          {r.whatsapp ? (
            <a href={`https://wa.me/${r.whatsapp}`} className="text-orange-600 underline">
              WhatsApp
            </a>
          ) : null}
          {r.whatsapp && r.github ? " · " : null}
          <a href={r.github} className="text-orange-600 underline" target="_blank" rel="noopener noreferrer">
            GitHub do projeto
          </a>
          .
        </p>
      </section>

      <section>
        <h2>2. Quais dados coletamos e por quê</h2>
        <p className="font-semibold text-zinc-900">Vendedores (quem cria conta)</p>
        <ul>
          <li>
            <strong>Conta:</strong> e-mail, nome de usuário e senha (a senha é guardada com criptografia; nem a equipe
            consegue ler) e o registro do aceite dos Termos.
          </li>
          <li>
            <strong>Perfil público:</strong> nome do negócio, descrição, WhatsApp, bairro, cidade, ramo, horários,
            menu, fotos, logo e cardápio que você enviar. Esses dados são exibidos para qualquer visitante, porque é
            a finalidade do site.
          </li>
          <li>
            <strong>Uso do painel:</strong> histórico de alterações (quem mudou o quê e quando), para segurança e suporte.
          </li>
        </ul>
        <p className="mt-3 font-semibold text-zinc-900">Clientes (quem só visita)</p>
        <ul>
          <li>
            <strong>Não pedimos cadastro.</strong> Você navega sem informar nome, e-mail ou telefone.
          </li>
          <li>
            <strong>Avaliação:</strong> o vendedor informa o seu e-mail só para o site enviar um convite com um link único;
            o vendedor não vê o link. Guardamos o convite sem o seu e-mail completo (só um código embaralhado e a forma
            mascarada, como m***@gmail.com) e a avaliação, com nota e comentário. O seu nome é <strong>opcional</strong>: se
            você digitar um nome ou apelido, ele aparece publicamente junto da avaliação; se deixar em branco, ela aparece
            como anônima. O envio do e-mail é feito por um serviço de e-mail contratado. Evite colocar dados pessoais no
            comentário.
          </li>
          <li>
            <strong>Pedido pelo site</strong> (só se você fizer um pedido): seu nome, telefone com DDD, endereço (quando for
            entrega), o meio de pagamento escolhido (e o troco, se houver), as observações e os itens pedidos. Servem para a
            loja preparar e entregar o pedido e entrar em contato com você. <strong>Quem vê é a loja onde você pediu</strong>;
            o painel de administração do site mostra só números, sem esses dados. O site <strong>não processa nem recebe o
            pagamento</strong>: ele é feito direto com a loja. Você acompanha o pedido por um link que só você recebe (quem
            tem o link vê o pedido, cancela enquanto a loja não começou e avalia depois de concluído; por isso não o
            compartilhe, e ele <strong>nunca é enviado à loja</strong>). A loja pode recusar um pedido e bloquear o telefone
            em pedidos falsos; guardamos só um código embaralhado do telefone e os 4 últimos dígitos.
          </li>
          <li>
            <strong>Denúncia:</strong> motivo, descrição e, se você quiser, um contato para a equipe falar com você. O
            contato é opcional.
          </li>
          <li>
            <strong>Fale conosco:</strong> tipo, mensagem, página de onde você escreveu e, se você quiser, um contato para
            a resposta. O contato é opcional. Não escreva senhas nem dados de pagamento.
          </li>
        </ul>
        <p className="mt-3 font-semibold text-zinc-900">Dados técnicos (todos os visitantes)</p>
        <ul>
          <li>
            <strong>Contagem de visitas e de toques no botão do WhatsApp</strong>, sem identificar a pessoa, para o
            vendedor saber se a loja está sendo vista.
          </li>
          <li>
            <strong>Endereço IP:</strong> usado apenas na forma de um código embaralhado (hash), por até 7 dias, para
            limitar abusos (muitas denúncias, tentativas de adivinhar senhas ou códigos).
          </li>
        </ul>
        <p className="mt-3">
          <strong>Bases legais:</strong> execução do serviço que você contratou ao criar a conta, cumprimento de
          obrigação legal, legítimo interesse (segurança e prevenção a fraudes) e consentimento, quando for o caso.
        </p>
      </section>

      <section>
        <h2>3. Cookies e armazenamento no navegador</h2>
        <p>
          Usamos apenas o que é necessário para o site funcionar: o <em>cookie de sessão</em> do vendedor logado e a
          lembrança da cidade escolhida. Guardamos também, na sessão da aba, um aviso de que a visita já foi contada, e,
          no seu navegador, o <em>carrinho</em> do pedido (itens e quantidades de cada loja), que fica só no seu aparelho
          e sai quando você envia o pedido, e a lista <em>Meus pedidos</em> (o link, o número, a loja e o valor de cada
          pedido que você fez), também só no seu aparelho, para você acompanhar o que pediu. Você pode tirar um pedido da
          lista ou apagá-la quando quiser, na página Meus pedidos.
          Não usamos cookies de publicidade nem rastreadores de terceiros, por isso não exibimos faixa de cookies.
        </p>
      </section>

      <section>
        <h2>4. Com quem compartilhamos</h2>
        <ul>
          <li>
            <strong>Provedores que fazem o site funcionar:</strong> banco de dados, autenticação e armazenamento de
            arquivos (Supabase), hospedagem (Vercel) e envio do e-mail de confirmação. Eles só tratam os dados para
            nos prestar o serviço, e podem usar servidores fora do Brasil, com as salvaguardas legais.
          </li>
          <li>
            <strong>WhatsApp:</strong> ao tocar em &ldquo;Pedir pelo WhatsApp&rdquo; ou em &ldquo;Avisar a loja pelo
            WhatsApp&rdquo; você sai do nosso site e passa a seguir as regras do WhatsApp. Não recebemos o conteúdo da
            conversa.
          </li>
          <li>
            <strong>A loja onde você faz um pedido:</strong> recebe os dados do pedido (nome, telefone, endereço, itens e
            observações) para atendê-lo, e só deve usá-los para isso.
          </li>
          <li>
            <strong>Autoridades</strong>, quando houver ordem legal.
          </li>
        </ul>
        <p className="mt-2">Não vendemos nem alugamos dados pessoais.</p>
      </section>

      <section>
        <h2>5. Por quanto tempo guardamos</h2>
        <table>
          <thead>
            <tr>
              <th>Dado</th>
              <th>Prazo</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Conta e perfil do vendedor</td>
              <td>Enquanto a conta existir. Ao excluir, apagamos o perfil, o menu e os arquivos.</td>
            </tr>
            <tr>
              <td>Tentativas de login e de código de avaliação</td>
              <td>7 dias</td>
            </tr>
            <tr>
              <td>Código embaralhado do IP nas métricas, nas denúncias e no Fale conosco</td>
              <td>7 dias (a contagem fica, o IP some)</td>
            </tr>
            <tr>
              <td>Contato de quem denunciou</td>
              <td>180 dias depois de a denúncia ser tratada</td>
            </tr>
            <tr>
              <td>Mensagens do Fale conosco</td>
              <td>12 meses depois de tratadas; o contato de quem escreveu some em 180 dias</td>
            </tr>
            <tr>
              <td>Métricas de visitas e toques</td>
              <td>25 meses</td>
            </tr>
            <tr>
              <td>Histórico de alterações</td>
              <td>2 anos</td>
            </tr>
            <tr>
              <td>Convites de avaliação usados, cancelados ou vencidos</td>
              <td>90 dias</td>
            </tr>
            <tr>
              <td>Nome, telefone, endereço e observações de um pedido pelo site</td>
              <td>90 dias depois de o pedido ser encerrado (concluído ou cancelado). Pedido que a loja não responde vence em 3 dias</td>
            </tr>
            <tr>
              <td>Itens e valores dos pedidos, sem identificar o cliente</td>
              <td>25 meses (para os números da loja)</td>
            </tr>
            <tr>
              <td>Registros de pagamento do plano destaque</td>
              <td>Pelo prazo exigido por lei fiscal e contábil</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2">A limpeza dos prazos acima é automática e diária.</p>
      </section>

      <section>
        <h2>6. Seus direitos</h2>
        <p>Você pode, a qualquer momento, pedir:</p>
        <ul>
          <li>confirmação de que tratamos seus dados e acesso a eles;</li>
          <li>correção de dados incompletos ou errados;</li>
          <li>anonimização, bloqueio ou eliminação de dados desnecessários;</li>
          <li>portabilidade dos dados;</li>
          <li>informação sobre com quem compartilhamos;</li>
          <li>revogação do consentimento, quando a base for o consentimento.</li>
        </ul>
        <p className="mt-2">
          <strong>Vendedores</strong> resolvem boa parte disso sozinhos no painel: editam o perfil, <strong>baixam uma cópia
          dos próprios dados</strong> (aba Perfil, &ldquo;Baixar meus dados&rdquo;) e podem{" "}
          <Link href="/painel" className="text-orange-600 underline">
            excluir a própria conta
          </Link>{" "}
          (aba Perfil, &ldquo;Excluir minha conta&rdquo;). Para os demais pedidos, use o contato da seção 1. Respondemos
          em até 15 dias.
        </p>
      </section>

      <section>
        <h2>7. Segurança</h2>
        <p>
          Usamos conexão criptografada, senhas protegidas, controle de acesso por conta (cada vendedor só vê e edita o
          que é seu), limites contra tentativas em massa e registro de alterações. Nenhum sistema é totalmente
          imune: se houver incidente que possa causar dano relevante, avisaremos os afetados e a autoridade
          competente, conforme a lei.
        </p>
      </section>

      <section>
        <h2>8. Crianças e adolescentes</h2>
        <p>
          O cadastro de vendedor é destinado a maiores de 18 anos. Não coletamos intencionalmente dados de crianças.
        </p>
      </section>

      <section>
        <h2>9. Mudanças nesta política</h2>
        <p>
          Podemos atualizar este texto. A versão e a data ficam no topo da página; mudanças relevantes serão avisadas
          no painel do vendedor. Veja também os{" "}
          <Link href="/termos" className="text-orange-600 underline">
            Termos de Uso
          </Link>
          .
        </p>
      </section>
    </PaginaLegal>
  );
}
