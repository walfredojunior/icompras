"use client";

import { Radar, ChartLine, Gauge, CreditCard, Users, BookOpen, Images, LayoutGrid, Star, Coins, Store, KeyRound, NotebookPen, LogOut } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";

const ITEMS = [
  { href: "/admin/scraper", label: "Scraper", Icon: Radar },
  { href: "/admin/monitor", label: "Monitor VPS", Icon: Gauge },
  { href: "/admin/visitas", label: "Visitas", Icon: ChartLine },
  { href: "/admin/planos", label: "Planos", Icon: CreditCard },
  { href: "/admin/clientes", label: "Clientes", Icon: Users },
  { href: "/admin/api", label: "API (manual)", Icon: BookOpen },
  { href: "/admin/banners", label: "Banners", Icon: Images },
  { href: "/admin/blocos", label: "Blocos de destaque", Icon: LayoutGrid },
  { href: "/admin/destaques", label: "Destaques", Icon: Star },
  { href: "/admin/cambio", label: "Câmbio", Icon: Coins },
  { href: "/admin/leads", label: "Lojas (leads)", Icon: Store },
  // Anotações fica junto de "Trocar senha": as duas são sobre acesso — e a
  // primeira coisa que a página de anotações pede é justamente trocar a senha.
  { href: "/admin/anotacoes", label: "Anotações", Icon: NotebookPen },
  { href: "/admin/senha", label: "Trocar senha", Icon: KeyRound },
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
          {ITEMS.map(({ href, label, Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/") || pathname === href;
            return (
              <Link key={href} href={href} className={`${base} ${isActive ? active : inactive}`}>
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
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
