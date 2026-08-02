import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/adminauth";
import { updateStoreProfile } from "@/lib/clients";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as any;
  await updateStoreProfile(Number(id), {
    name: b.name,
    logoUrl: b.logoUrl ?? null,
    address: b.address ?? null,
    city: b.city ?? null,
    phone: b.phone ?? null,
    website: b.website ?? null,
    description: b.description ?? null,
    mapsQuery: b.mapsQuery ?? null,
    selfManaged: b.selfManaged !== false,
  });
  return NextResponse.json({ ok: true });
}
