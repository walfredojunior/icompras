"use client";

import { useRouter } from "@/i18n/navigation";

export function AdminMenu({ email }: { email: string }) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/entrar");
    router.refresh();
  }
  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-slate-600 sm:inline">{email}</span>
      <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-800">
        Sair
      </button>
    </div>
  );
}
