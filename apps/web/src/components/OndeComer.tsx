import { getTranslations } from "next-intl/server";
import { UtensilsCrossed, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { listarRestaurantes, rotuloDoTipo } from "@/lib/restaurantes";
import { CarrosselDeRestaurantes } from "./CarrosselDeRestaurantes";

// O BLOCO "ONDE COMER" NA HOME (22/08/2026, refeito).
//
// ⚠ MUDOU DE IDEIA E DE FORMA. Em 21/08 isto era uma tira com TODOS os
// restaurantes na home. Ele decidiu outra coisa: **um bloco só**, no formato dos
// Destaques, com as fotos revezando — e o clique levando à página com a lista
// completa.
//
// 💡 A razão comercial é boa: a home tem espaço limitado e o guia cresce. Com um
// bloco de tamanho fixo, dá para listar 5 ou 50 restaurantes sem que a home
// mude de tamanho — e a página que recebe o clique é a que o Google indexa.
//
// Some sozinho quando não há nenhum restaurante no ar, como os Destaques e as
// quedas de preço.

export async function OndeComer({ locale }: { locale: string }) {
  const restaurantes = await listarRestaurantes();
  if (!restaurantes.length) return null;

  const t = await getTranslations("ondeComer");
  const ts = await getTranslations("search");

  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <UtensilsCrossed className="h-5 w-5 text-brand-green" />
          {t("title")}
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-wide text-slate-400">{ts("ad")}</span>
          <Link
            href="/onde-comer"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-navy hover:underline"
          >
            {t("seeAll")} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <CarrosselDeRestaurantes
        restaurantes={restaurantes.map((r) => ({
          id: r.id,
          nome: r.nome,
          cidade: r.cidade,
          // O tipo já traduzido: o carrossel é componente de cliente e não tem
          // como pedir tradução ao servidor.
          tipo: rotuloDoTipo(r.tipo, locale),
          foto_url: r.foto_url,
          destaque: r.destaque,
        }))}
        verTodos={t("seeAll")}
      />
    </section>
  );
}
