"use client";

import { useRouter } from "@/i18n/navigation";

export function UserMenu({ email, logoutLabel }: { email: string; logoutLabel: string }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden max-w-[140px] truncate text-sm text-slate-600 sm:inline">{email}</span>
      <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-800">
        {logoutLabel}
      </button>
    </div>
  );
}
