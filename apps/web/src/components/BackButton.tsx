"use client";

import { useRouter } from "next/navigation";

// Volta para a página anterior (busca, categoria, etc.). Se a pessoa abriu o
// link direto (sem histórico), cai no fallback (home do idioma).
export function BackButton({ label, fallbackHref }: { label: string; fallbackHref: string }) {
  const router = useRouter();

  function go() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      onClick={go}
      className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-800"
    >
      ← {label}
    </button>
  );
}
