import { getTranslations } from "next-intl/server";
import { getAllCategories } from "@/lib/categories";
import { CategoryStrip } from "./CategoryStrip";

// Rótulo curto SÓ para a faixa da home.
//
// Dois grupos sozinhos custavam 414px dos 1.340px da faixa: "Saúde, Beleza &
// Moda" (200px) e "Lazer, Hobby & Camping" (214px). Encurtando esses dois, a
// faixa passa a caber em uma linha na maioria dos monitores.
//
// É um apelido de exibição: o nome completo continua no banco e aparece na
// página da categoria, na barra lateral e no caminho de navegação. Ninguém
// perde a informação de que o grupo também tem moda ou hobby.
const APELIDOS: Record<string, Record<string, string>> = {
  "saude-beleza-moda": {
    "pt-BR": "Saúde & Beleza",
    es: "Salud & Belleza",
    en: "Health & Beauty",
  },
  "lazer-hobby-camping": {
    "pt-BR": "Lazer & Camping",
    es: "Ocio & Camping",
    en: "Leisure & Camping",
  },
};

export async function CategoryNav({ locale }: { locale: string }) {
  const t = await getTranslations("categories");
  const cats = await getAllCategories(locale);

  return (
    <CategoryStrip
      todasLabel={t("all")}
      itens={cats.map((c) => ({
        slug: c.slug,
        label: APELIDOS[c.slug]?.[locale] ?? c.name,
      }))}
    />
  );
}
