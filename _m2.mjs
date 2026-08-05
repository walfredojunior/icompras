import mariadb from "mariadb";
import { readFileSync } from "fs";
const APLICAR=process.argv.includes("--aplicar");
const env=Object.fromEntries(readFileSync("/opt/icompras/app/.env","utf8").split("\n").filter(l=>l.includes("=")).map(l=>[l.slice(0,l.indexOf("=")),l.slice(l.indexOf("=")+1)]));
const c=await mariadb.createConnection({host:env.DB_HOST,port:+env.DB_PORT,user:env.DB_USER,password:env.DB_PASSWORD,database:env.DB_NAME});
const STOP=new Set(["de","da","do","com","para","e","the","of","na","loja","em"]);
const toks=s=>s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"").split(/[^a-z0-9]+/).filter(t=>t.length>=2&&!STOP.has(t));
const ov=(a,b)=>{if(!a.length)return 0;const bs=new Set(b);return a.filter(t=>bs.has(t)).length/a.length;};
const rows=await c.query(`SELECT o.id oid, o.price_usd pr, o.title, p.id pid, p.canonical_name nome
  FROM offer o JOIN product_variant v ON v.id=o.variant_id JOIN product p ON p.id=v.product_id
 WHERE o.source="scraped" AND o.price_usd IS NOT NULL`);
const porProd=new Map();
for(const r of rows){ if(!porProd.has(r.pid)) porProd.set(r.pid,{nome:r.nome,of:[]}); porProd.get(r.pid).of.push(r); }
const apagar=[]; const prods=new Set(); const amostras=[];
for(const [pid,d] of porProd){
  if(d.of.length<2) continue;
  const maior=Math.max(...d.of.map(o=>Number(o.pr)));
  const pt=toks(d.nome);
  for(const o of d.of){
    const s=o.title? ov(pt,toks(o.title)) : 1;   // sem titulo nao se julga
    if(s < 0.25 && Number(o.pr) < maior/5){
      apagar.push(o.oid); prods.add(pid);
      if(amostras.length<10) amostras.push(`US$ ${String(o.pr).padStart(8)} (outra oferta: US$ ${maior}) | ${d.nome.slice(0,30)} <== ${String(o.title).slice(0,30)}`);
    }
  }
}
console.log(APLICAR?"=== APLICANDO ===":"=== CONFERENCIA ===");
console.log("ofertas com titulo errado E preco absurdo:", apagar.length, "| produtos:", prods.size);
amostras.forEach(a=>console.log("  "+a));
if(APLICAR && apagar.length){
  for(let i=0;i<apagar.length;i+=500){ const l=apagar.slice(i,i+500); await c.query(`DELETE FROM offer WHERE id IN (${l.map(()=>"?").join(",")})`,l); }
  const ids=[...prods];
  for(let i=0;i<ids.length;i+=500){ const l=ids.slice(i,i+500); const q=l.map(()=>"?").join(",");
    await c.query(`UPDATE product p SET p.min_price_usd=(SELECT MIN(o.price_usd) FROM offer o JOIN product_variant v ON v.id=o.variant_id WHERE v.product_id=p.id) WHERE p.id IN (${q})`,l);
    await c.query(`DELETE FROM product_price_daily WHERE day=CURDATE() AND product_id IN (${q})`,l); }
  console.log("apagadas, precos recalculados, resumo do dia refeito.");
}
await c.end();
