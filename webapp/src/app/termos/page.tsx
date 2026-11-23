import type { Metadata } from "next";
import Link from "next/link";
import { PaginaLegal } from "@/components/PaginaLegal";
import { responsavel } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "Regras de uso do Sabor Local para vendedores e visitantes.",
};

export default function TermosPage() {
  const r = responsavel();

  return (
    <PaginaLegal titulo="Termos de Uso">
      <p>
        Estes Termos valem para quem usa o Sabor Local, seja visitando o catálogo ou mantendo uma conta de vendedor. Ao
        criar uma conta ou usar o site, você concorda com eles. Eles complementam a{" "}
        <Link href="/privacidade" className="text-orange-600 underline">
          Política de Privacidade
        </Link>
        .
      </p>

      <section>
        <h2>1. O que é o Sabor Local</h2>
        <p>
          Uma vitrine que ajuda moradores a descobrir onde comer na cidade e vendedores a serem encontrados. O Sabor Local
          <strong> não vende, não entrega e não processa pagamentos</strong>. Pedido, preço final, pagamento e entrega
          são combinados diretamente entre cliente e vendedor, normalmente pelo WhatsApp.
        </p>
      </section>

      <section>
        <h2>2. Conta de vendedor</h2>
        <ul>
          <li>Você deve ter 18 anos ou mais e informar dados verdadeiros (nome do negócio, WhatsApp, bairro).</li>
          <li>Você é responsável pela sua conta e pela sua senha. Avise-nos se achar que alguém a usou sem permissão.</li>
          <li>
            Perfis novos passam por aprovação da equipe antes de aparecer no catálogo. Podemos recusar, suspender ou
            remover perfis que descumpram estes Termos.
          </li>
          <li>Você pode excluir sua conta quando quiser, no painel.</li>
        </ul>
      </section>

      <section>
        <h2>3. Conteúdo que você publica</h2>
        <ul>
          <li>
            Você mantém a propriedade de textos, fotos, logo e cardápio que enviar, e nos autoriza a exibi-los no site
            enquanto sua conta existir.
          </li>
          <li>Só envie o que você pode usar (fotos e marcas que não sejam de terceiros sem autorização).</li>
          <li>
            É proibido conteúdo ilegal, enganoso, ofensivo, discriminatório ou que ponha pessoas em risco. Mantenha
            preços, horários e disponibilidade atualizados.
          </li>
          <li>
            O vendedor responde pelos produtos que anuncia, inclusive pelas regras sanitárias, fiscais e de defesa do
            consumidor aplicáveis ao seu negócio.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Avaliações e denúncias</h2>
        <ul>
          <li>Avaliações só são aceitas por um convite enviado ao e-mail de quem fez o pedido, e passam por moderação.</li>
          <li>
            O vendedor pode colocar no perfil o link do próprio site ou cardápio online. O Sabor Local não controla esses sites
            e não responde por eles, e pode remover um link impróprio ou suspeito.
          </li>
          <li>É proibido avaliar sem ter comprado, trocar código por vantagem indevida ou criar avaliações falsas.</li>
          <li>
            Qualquer pessoa pode denunciar um perfil ou avaliação. A equipe analisa e pode remover conteúdo ou suspender
            perfis. Denúncias de má-fé podem ser desconsideradas.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Pedidos pelo site</h2>
        <ul>
          <li>
            O vendedor decide se recebe pedidos pelo site. O Sabor Local só <strong>organiza</strong> o pedido (itens, quantidades,
            valor calculado a partir do cardápio, entrega ou retirada, meio de pagamento escolhido e observações) e o repassa
            à loja.
          </li>
          <li>
            <strong>Não processamos nem recebemos pagamentos.</strong> O meio de pagamento é só uma escolha informada no pedido; o
            pagamento é feito direto entre cliente e vendedor, na entrega ou na retirada.
          </li>
          <li>
            Fazer um pedido não é uma compra concluída: a loja pode aceitar, recusar ou cancelar (por exemplo, por falta de produto
            ou fora da área de entrega), e informa o motivo. Preço, prazo, entrega, troca e cancelamento são
            responsabilidade do vendedor, que deve respeitar a legislação de defesa do consumidor.
          </li>
          <li>
            O vendedor usa nome, telefone e endereço do cliente <strong>somente para atender o pedido</strong>. É proibido usá-los para
            outra finalidade, repassá-los ou fazer lista de contatos.
          </li>
          <li>
            O cliente informa dados verdadeiros. Pedidos falsos ou em excesso podem ser recusados, e o vendedor pode bloquear um
            telefone na sua loja. O site aceita pedidos só com a loja aberta e limita a quantidade de pedidos por pessoa.
          </li>
          <li>O vendedor deve manter horários, preços, itens disponíveis e a taxa de entrega atualizados.</li>
        </ul>
      </section>

      <section>
        <h2>6. Plano destaque</h2>
        <p>
          É opcional. O valor, o período e a forma de pagamento (Pix ou dinheiro) são informados antes de você pagar. O
          pagamento é feito diretamente à equipe, que registra o período de destaque no seu perfil. O destaque coloca
          sua loja em posição privilegiada e exibe um selo, mas <strong>não garante aumento de vendas</strong>. Se você
          tiver direito de arrependimento ou de reembolso pela lei, ele será respeitado.
        </p>
      </section>

      <section>
        <h2>7. Limites de responsabilidade</h2>
        <ul>
          <li>
            Não somos parte da compra: qualidade, preço, prazo, entrega e cancelamento são responsabilidade do vendedor.
          </li>
          <li>
            Procuramos manter o site no ar, mas ele pode ficar indisponível por manutenção ou falhas de terceiros, sem
            garantia de funcionamento ininterrupto.
          </li>
          <li>
            Informações do catálogo (cardápio, horário, status de aberto) são fornecidas pelos próprios vendedores e
            podem estar desatualizadas.
          </li>
        </ul>
      </section>

      <section>
        <h2>8. Uso adequado do site</h2>
        <p>
          Não tente burlar limites, descobrir senhas ou códigos, sobrecarregar o site, copiar dados em massa ou usar o
          site para spam. Testes de segurança só com autorização por escrito.
        </p>
      </section>

      <section>
        <h2>9. Mudanças e contato</h2>
        <p>
          Podemos atualizar estes Termos; a versão e a data ficam no topo. Quando a mudança for relevante, pediremos
          novo aceite. Dúvidas e solicitações:{" "}
          {r.email ? (
            <a href={`mailto:${r.email}`} className="text-orange-600 underline">
              {r.email}
            </a>
          ) : (
            <a href={r.github} className="text-orange-600 underline" target="_blank" rel="noopener noreferrer">
              GitHub do projeto
            </a>
          )}
          {r.whatsapp ? (
            <>
              {" · "}
              <a href={`https://wa.me/${r.whatsapp}`} className="text-orange-600 underline">
                WhatsApp
              </a>
            </>
          ) : null}
          . Responsável: {r.nome}.
        </p>
      </section>

      <section>
        <h2>10. Lei aplicável</h2>
        <p>
          Aplica-se a legislação brasileira. Quando houver relação de consumo, fica garantido ao consumidor o foro do
          seu domicílio.
        </p>
      </section>
    </PaginaLegal>
  );
}
