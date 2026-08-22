import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/adminauth";
import { pool } from "@/lib/db";
import { getAllBanners, getMarcas } from "@/lib/banners";
import { BannerManager } from "@/components/BannerManager";
import { tabelaDePrecos } from "@/lib/precos";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function AdminBannersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await getCurrentAdmin())) redirect(`/${locale}/admin/entrar`);

  // AS CATEGORIAS, EM ORDEM ALFABÉTICA E COM O TAMANHO DE CADA UMA.
  //
  // ⚠ Antes era `ORDER BY c.position` — a ordem em que aparecem no site. Com
  // **519 categorias** numa caixa de seleção, achar "perfume" ali era rolar no
  // escuro. Alfabética + campo de busca (ver EscolherCategoria) é o que torna
  // a tela usável.
  //
  // 💡 `produtos` e `buscas` não são enfeite: são o argumento de preço. Perfume
  // com 30 mil produtos e 103 buscas no mês não pode custar o mesmo que uma
  // categoria de 40 produtos — e quem está vendendo precisa ver isso na hora.
  const categories = await pool.query(
    `SELECT c.slug,
            COALESCE(ct.name, c.slug) AS name,
            COALESCE(p.n, 0) AS produtos,
            COALESCE(b.n, 0) AS buscas
       FROM category c
       LEFT JOIN category_translation ct ON ct.category_id = c.id AND ct.locale = ?
       LEFT JOIN (
         SELECT category_id, COUNT(*) AS n FROM product GROUP BY category_id
       ) p ON p.category_id = c.id
       LEFT JOIN (
         SELECT s.term, SUM(s.searches) AS n
           FROM analytics_search s
          WHERE s.day > CURDATE() - INTERVAL 30 DAY
          GROUP BY s.term
       ) b ON b.term = c.slug
      ORDER BY name`,
    [locale],
  );
  // QUEM PODE SER CLIENTE DE PUBLICIDADE.
  //
  // ⚠⚠ CLIENTE E LEAD NÃO SÃO A MESMA COISA (22/08/2026). Ele reparou: "na hora
  // de buscar o cliente ele tá buscando as lojas que ainda nem tá como cliente".
  // Estava certo — das 163 lojas ativas, **157 são LEADS** trazidos pelo coletor
  // e apenas **6 são clientes**. A lista despejava tudo junto.
  //
  // 💡 MAS NÃO DÁ PARA SUMIR COM OS LEADS: vender publicidade é justamente como
  // um lead VIRA cliente. Por isso os dois vêm, separados em grupos, com os
  // clientes em cima.
  //
  // É cliente quem: não está marcado como lead, OU tem assinatura, OU já tem
  // pedido (comprou alguma coisa em algum momento).
  const stores = await pool.query(
    `SELECT s.id, s.name,
            EXISTS (SELECT 1 FROM product_store ps WHERE ps.store_id = s.id) AS tem_produto,
            (
              s.is_lead = 0
              OR EXISTS (SELECT 1 FROM subscription su WHERE su.store_id = s.id)
              OR EXISTS (SELECT 1 FROM pedido pe WHERE pe.store_id = s.id)
            ) AS eh_cliente
       FROM store s
      WHERE s.status = 'active'
      ORDER BY eh_cliente DESC, s.name
      LIMIT 1000`,
  );
  const banners = await getAllBanners();
  // Marcas do catálogo para o banner "todos os produtos da marca X". Vêm do
  // banco porque o texto precisa bater exatamente com o que está indexado.
  const marcas = await getMarcas();
  // A tabela de preços vai junto: é na hora de montar o banner que ele precisa
  // saber quanto cobrar, não numa tela separada.
  const precos = await tabelaDePrecos();

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-slate-900">Banners</h1>
      <BannerManager
        banners={banners as any}
        categories={categories.map((c: any) => ({
          slug: c.slug,
          name: c.name,
          produtos: Number(c.produtos ?? 0),
          buscas: Number(c.buscas ?? 0),
        }))}
        stores={stores.map((s: any) => ({
          id: Number(s.id),
          name: s.name,
          temProduto: Number(s.tem_produto ?? 0) === 1,
          ehCliente: Number(s.eh_cliente ?? 0) === 1,
        }))}
        marcas={marcas.map((m) => m.marca)}
        precos={precos as any}
      />
    </div>
  );
}
