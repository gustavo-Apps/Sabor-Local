import type { Vendedor } from "@/lib/types";

// Usado apenas quando o Supabase ainda não está configurado (.env.local ausente),
// para que o catálogo seja visualizável localmente desde o primeiro clone.
export const VENDEDORES_MOCK: Vendedor[] = [
  {
    id: "mock-1",
    nome: "Lanchonete da Esquina",
    descricao: "Cheeseburgers artesanais e batata rústica.",
    whatsapp: "5511999990001",
    modo_atendimento: "ambos",
    foto_capa_url: null,
    ativo: true,
    destaque_ate: null,
    categorias: [{ id: "c1", nome: "Lanches", slug: "lanches" }],
    bairro: { id: "b1", nome: "Centro" },
    horarios: [
      { id: "h1", vendedor_id: "mock-1", dia_semana: new Date().getDay(), abre: "18:00", fecha: "23:30" },
    ],
    itens_cardapio: [
      { id: "i1", vendedor_id: "mock-1", nome: "Cheeseburger Clássico", descricao: "Pão, blend 150g, queijo e molho da casa.", preco: 22, foto_url: null, ordem: 0 },
      { id: "i2", vendedor_id: "mock-1", nome: "Batata Rústica", descricao: "Porção com alecrim e parmesão.", preco: 14, foto_url: null, ordem: 1 },
    ],
  },
  {
    id: "mock-2",
    nome: "Marmitas da Dona Ivone",
    descricao: "Marmitas caseiras com opção de feijoada aos sábados.",
    whatsapp: "5511999990002",
    modo_atendimento: "retirada",
    foto_capa_url: null,
    ativo: true,
    destaque_ate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    categorias: [{ id: "c2", nome: "Marmitas", slug: "marmitas" }],
    bairro: { id: "b2", nome: "Vila Nova" },
    horarios: [
      { id: "h2", vendedor_id: "mock-2", dia_semana: new Date().getDay(), abre: "11:00", fecha: "14:00" },
    ],
    itens_cardapio: [
      { id: "i3", vendedor_id: "mock-2", nome: "Marmita Executiva", descricao: "Arroz, feijão, proteína e salada.", preco: 18, foto_url: null, ordem: 0 },
    ],
  },
  {
    id: "mock-3",
    nome: "Açaí do Zé",
    descricao: "Açaí na tigela com mix de frutas e granola.",
    whatsapp: "5511999990003",
    modo_atendimento: "entrega",
    foto_capa_url: null,
    ativo: true,
    destaque_ate: null,
    categorias: [{ id: "c3", nome: "Açaí e Doces", slug: "acai-e-doces" }],
    bairro: { id: "b3", nome: "Jardim das Flores" },
    horarios: [
      { id: "h3", vendedor_id: "mock-3", dia_semana: new Date().getDay(), abre: "13:00", fecha: "22:00" },
    ],
    itens_cardapio: [
      { id: "i4", vendedor_id: "mock-3", nome: "Açaí 500ml", descricao: "Com banana, morango e granola.", preco: 19, foto_url: null, ordem: 0 },
    ],
  },
  {
    id: "mock-4",
    nome: "Salgados da Tia Fran",
    descricao: "Coxinhas e risoles fritos na hora.",
    whatsapp: "5511999990004",
    modo_atendimento: "ambos",
    foto_capa_url: null,
    ativo: true,
    destaque_ate: null,
    categorias: [{ id: "c4", nome: "Salgados", slug: "salgados" }],
    bairro: { id: "b1", nome: "Centro" },
    horarios: [],
    itens_cardapio: [
      { id: "i5", vendedor_id: "mock-4", nome: "Coxinha de Frango", descricao: null, preco: 7, foto_url: null, ordem: 0 },
    ],
  },
];
