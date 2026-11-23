export function buildWhatsAppLink(whatsapp: string, vendorName: string, item?: { nome: string; preco?: number | null }) {
  const digits = whatsapp.replace(/\D/g, "");
  const pedido = item
    ? `gostaria de pedir: ${item.nome}${
        item.preco != null ? ` (${item.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})` : ""
      }.`
    : "gostaria de fazer um pedido.";
  const message = encodeURIComponent(`Olá! Vi o perfil de ${vendorName} no Sabor Local e ${pedido}`);
  return `https://wa.me/${digits}?text=${message}`;
}
