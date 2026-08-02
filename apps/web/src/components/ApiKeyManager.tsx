"use client";

import { useState } from "react";

export interface ApiKeyDict {
  generate: string;
  regenerate: string;
  warning: string;
  none: string;
}

export function ApiKeyManager({ hasKey, dict }: { hasKey: boolean; dict: ApiKeyDict }) {
  const [key, setKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    const res = await fetch("/api/store/apikey", { method: "POST" });
    const j = await res.json().catch(() => ({}));
    setKey(j.key ?? null);
    setLoading(false);
  }

  return (
    <div>
      {key ? (
        <div>
          <code className="block break-all rounded-lg bg-slate-900 px-4 py-3 text-sm text-brand-green">{key}</code>
          <p className="mt-2 text-xs text-amber-600">{dict.warning}</p>
        </div>
      ) : (
        <>
          {!hasKey && <p className="mb-2 text-sm text-slate-500">{dict.none}</p>}
          <button
            onClick={generate}
            disabled={loading}
            className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-dark disabled:opacity-60"
          >
            {hasKey ? dict.regenerate : dict.generate}
          </button>
        </>
      )}
    </div>
  );
}
