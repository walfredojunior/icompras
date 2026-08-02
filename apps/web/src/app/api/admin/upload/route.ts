import { NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { getCurrentAdmin } from "@/lib/adminauth";

export async function POST(req: Request) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  }
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo ausente." }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const out = await sharp(buf).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const name = `${createHash("sha1").update(buf).digest("hex").slice(0, 16)}.webp`;
  const dir = join(process.cwd(), "public", "media", "banners");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), out);
  return NextResponse.json({ url: `/media/banners/${name}` });
}
