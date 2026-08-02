"use client";

import { useRouter } from "@/i18n/navigation";

export function StoreMenu({ name, logoutLabel }: { name: string; logoutLabel: string }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/store/logout", { method: "POST" });
    router.push("/painel/entrar");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-slate-600 sm:inline">{name}</span>
      <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-800">
        {logoutLabel}
      </button>
    </div>
  );
}
