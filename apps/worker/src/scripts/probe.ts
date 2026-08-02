import { chromium } from "playwright";

const URL = "https://www.comprasparaguai.com.br/celular-apple-iphone-17-pro-256gb_63989/";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
});
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(7000);

const items = await page.evaluate(() => {
  const out: Array<Record<string, string | null>> = [];
  document.querySelectorAll(".promocao-item-info").forEach((info) => {
    let card: Element | null = info.parentElement;
    for (let k = 0; k < 4 && card && !card.querySelector(".promocao-item-preco-oferta"); k++) {
      card = card.parentElement;
    }
    if (!card) return;
    const priceEl = card.querySelector(".promocao-item-preco-oferta strong");
    const price = priceEl ? (priceEl.textContent || "").trim() : null;
    const nameEl = info.querySelector(".promocao-item-nome a");
    const title = nameEl ? (nameEl.textContent || "").trim() : null;
    const redirect = info.querySelector(".btn-store-redirect");
    const onclick = redirect ? redirect.getAttribute("onclick") || "" : "";
    const adv = onclick.match(/advertiser['"]?\s*:\s*['"]([^'"]+)['"]/);
    const store = adv ? adv[1] : null;
    const wa = info.querySelector('a[href*="api.whatsapp.com"]');
    const ph = wa ? ((wa.getAttribute("href") || "").match(/phone=(\d+)/) || [])[1] : null;
    if (price && store) out.push({ store, price, phone: ph ?? null, title });
  });
  return out;
});

console.log(`Total de ofertas extraídas na página: ${items.length}`);
// filtra as deste produto (título contém iphone + 17 + pro + 256)
const wanted = items.filter((i) => {
  const t = (i.title || "").toLowerCase();
  return t.includes("iphone") && t.includes("17") && t.includes("pro") && t.includes("256");
});
console.log(`Ofertas do iPhone 17 Pro 256GB: ${wanted.length}`);
wanted.slice(0, 15).forEach((i) => console.log(`  ${i.store} — ${i.price}${i.phone ? " — tel " + i.phone : ""}`));

await browser.close();
