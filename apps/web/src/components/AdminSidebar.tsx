"use client";

import { Radar, ChartLine, Gauge, CreditCard, Users, BookOpen, Images, LayoutGrid, Star, Coins, Store, KeyRound, NotebookPen, LogOut, Sparkles, DollarSign, Receipt, UtensilsCrossed } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";

// O MENU, AGRUPADO POR ASSUNTO (21/08/2026).
//
// ⚠ Era uma lista plana de 15 itens. Funcionava enquanto o painel era pequeno,
// mas quando a parte comercial cresceu (banners, tabela de preços, contas) ela
// ficou espalhada entre Scraper, Monitor VPS e Câmbio — coisas de manutenção do
// sistema. Não dava para bater o olho e achar onde se vende.
//
// 💡 A ordem dos grupos é a de uso: o que ele abre todo dia primeiro; o que
// guarda segredo (PYIA, Anotações, Senha) por último.
const GRUPOS: Array<{ titulo: string; itens: Array<{ href: string; label: string; Icon: typeof Radar }> }> = [
  {
    titulo: "Publicidade",
    itens: [
      { href: "/admin/vendas", label: "Vendas e contas", Icon: Receipt },
      { href: "/admin/banners", label: "Banners", Icon: Images },
      { href: "/admin/precos", label: "Tabela de preços", Icon: DollarSign },
      { href: "/admin/restaurantes", label: "Onde comer", Icon: UtensilsCrossed },
    ],
  },
  {
    titulo: "Clientes",
    itens: [
      { href: "/admin/clientes", label: "Clientes", Icon: Users },
      { href: "/admin/leads", label: "Lojas (leads)", Icon: Store },
      { href: "/admin/planos", label: "Planos", Icon: CreditCard },
      { href: "/admin/api", label: "API (manual)", Icon: BookOpen },
    ],
  },
  {
    titulo: "Site",
    itens: [
      { href: "/admin/blocos", label: "Blocos de destaque", Icon: LayoutGrid },
      { href: "/admin/destaques", label: "Destaques", Icon: Star },
      { href: "/admin/cambio", label: "Câmbio", Icon: Coins },
      { href: "/admin/visitas", label: "Visitas", Icon: ChartLine },
    ],
  },
  {
    titulo: "Sistema",
    itens: [
      { href: "/admin/scraper", label: "Scraper", Icon: Radar },
      { href: "/admin/monitor", label: "Monitor VPS", Icon: Gauge },
      // PYIA, Anotações e Trocar senha ficam juntas e por último: as três
      // guardam segredo (chaves, senhas) e são as que mais precisam do painel
      // bem trancado.
      { href: "/admin/ia", label: "PYIA", Icon: Sparkles },
      { href: "/admin/anotacoes", label: "Anotações", Icon: NotebookPen },
      { href: "/admin/senha", label: "Trocar senha", Icon: KeyRound },
    ],
  },
];

export function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/entrar");
    router.refresh();
  }

  const base = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition";
  const active = "bg-brand-green-light font-medium text-brand-green-dark";
  const inactive = "text-slate-600 hover:bg-slate-50 hover:text-brand-navy";

  return (
    <aside className="w-full lg:w-60 lg:shrink-0">
      <div className="lg:sticky lg:top-20">
        <div className="mb-4 px-3">
          <div className="text-lg font-bold text-slate-900">Administração</div>
          <div className="truncate text-xs text-slate-400">{email}</div>
        </div>
        <nav className="space-y-1 rounded-2xl border border-slate-200 bg-white p-2">
          {GRUPOS.map((grupo, iGrupo) => (
            <div key={grupo.titulo}>
              <p
                className={`px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 ${
                  iGrupo === 0 ? "pt-1" : "pt-3"
                }`}
              >
                {grupo.titulo}
              </p>
              {grupo.itens.map(({ href, label, Icon }) => {
                const isActive = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link key={href} href={href} className={`${base} ${isActive ? active : inactive}`}>
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                );
              })}
            </div>
          ))}
          <div className="my-1 border-t border-slate-100" />
          <button onClick={logout} className={`${base} w-full text-slate-500 hover:bg-slate-50 hover:text-red-600`}>
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </nav>
      </div>
    </aside>
  );
}
