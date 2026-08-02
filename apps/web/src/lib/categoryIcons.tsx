import {
  Smartphone,
  Laptop,
  Tv,
  House,
  Shirt,
  Sparkles,
  Dumbbell,
  Car,
  Tent,
  UtensilsCrossed,
  HeartPulse,
  Watch,
  Gamepad2,
  Tag,
  type LucideIcon,
} from "lucide-react";

// Ícone por categoria-raiz. Os slugs espelham a árvore do site de origem;
// os da árvore antiga ficam mapeados para não quebrar links já guardados.
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  eletronicos: Tv,
  informatica: Laptop,
  "saude-beleza-moda": Sparkles,
  automotivo: Car,
  "lazer-hobby-camping": Tent,
  "casa-construcao": House,
  "alimentos-bebidas": UtensilsCrossed,
  // árvore antiga
  celulares: Smartphone,
  casa: House,
  moda: Shirt,
  beleza: Sparkles,
  esportes: Dumbbell,
};

export function categoryIcon(slug: string): LucideIcon {
  return CATEGORY_ICONS[slug] ?? Tag;
}

// Ícones escolhíveis no painel para os blocos de destaque da home.
// (chave = o que fica gravado no banco; rótulo = o que o admin lê)
export const BLOCK_ICONS: Array<{ key: string; label: string; Icon: LucideIcon }> = [
  { key: "smartphone", label: "Celular / Tecnologia", Icon: Smartphone },
  { key: "laptop", label: "Informática", Icon: Laptop },
  { key: "tv", label: "Eletrônicos", Icon: Tv },
  { key: "sparkles", label: "Beleza / Perfumes", Icon: Sparkles },
  { key: "heart-pulse", label: "Saúde / Suplementos", Icon: HeartPulse },
  { key: "watch", label: "Relógios / Acessórios", Icon: Watch },
  { key: "shirt", label: "Moda", Icon: Shirt },
  { key: "dumbbell", label: "Esportes", Icon: Dumbbell },
  { key: "house", label: "Casa", Icon: House },
  { key: "car", label: "Automotivo", Icon: Car },
  { key: "tent", label: "Lazer / Camping", Icon: Tent },
  { key: "utensils", label: "Alimentos / Bebidas", Icon: UtensilsCrossed },
  { key: "gamepad", label: "Games", Icon: Gamepad2 },
  { key: "tag", label: "Genérico", Icon: Tag },
];

const BLOCK_ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  BLOCK_ICONS.map((b) => [b.key, b.Icon]),
);

export function blockIcon(name: string | null): LucideIcon {
  return (name && BLOCK_ICON_MAP[name]) || Tag;
}
