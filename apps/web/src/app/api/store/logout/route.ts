import { NextResponse } from "next/server";
import { destroyStoreSession } from "@/lib/storeauth";

export async function POST() {
  await destroyStoreSession();
  return NextResponse.json({ ok: true });
}
