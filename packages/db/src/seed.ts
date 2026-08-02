import mariadb from 'mariadb';
import { dbConfig } from './env.js';

// Planos iniciais (valores em Guaraníes — ajustáveis depois no painel admin).
const PLANS = [
  { slug: 'free',    name: 'Gratuito', price: 0,       max_products: 20,   max_api: 100 },
  { slug: 'basic',   name: 'Básico',   price: 150000,  max_products: 500,  max_api: 2000 },
  { slug: 'pro',     name: 'Pro',      price: 400000,  max_products: 5000, max_api: 20000 },
  { slug: 'premium', name: 'Premium',  price: 900000,  max_products: 0,    max_api: 0 },
];

// Categorias-raiz com tradução nos 3 idiomas.
const CATEGORIES = [
  { slug: 'eletronicos', icon: 'cpu',    t: { 'pt-BR': 'Eletrônicos',       es: 'Electrónica',      en: 'Electronics' } },
  { slug: 'celulares',   icon: 'phone',  t: { 'pt-BR': 'Celulares',         es: 'Celulares',        en: 'Phones' } },
  { slug: 'informatica', icon: 'laptop', t: { 'pt-BR': 'Informática',       es: 'Informática',      en: 'Computers' } },
  { slug: 'casa',        icon: 'home',   t: { 'pt-BR': 'Casa',              es: 'Hogar',            en: 'Home' } },
  { slug: 'moda',        icon: 'shirt',  t: { 'pt-BR': 'Moda',              es: 'Moda',             en: 'Fashion' } },
  { slug: 'beleza',      icon: 'sparkles', t: { 'pt-BR': 'Beleza',          es: 'Belleza',          en: 'Beauty' } },
  { slug: 'esportes',    icon: 'dumbbell', t: { 'pt-BR': 'Esportes',        es: 'Deportes',         en: 'Sports' } },
];

// Subcategorias por categoria-raiz.
const SUBCATEGORIES: Record<string, Array<{ slug: string; t: Record<string, string> }>> = {
  celulares: [
    { slug: 'smartphones', t: { 'pt-BR': 'Smartphones', es: 'Smartphones', en: 'Smartphones' } },
    { slug: 'acessorios-celular', t: { 'pt-BR': 'Acessórios', es: 'Accesorios', en: 'Accessories' } },
  ],
  informatica: [
    { slug: 'notebooks', t: { 'pt-BR': 'Notebooks', es: 'Notebooks', en: 'Laptops' } },
    { slug: 'computadoras', t: { 'pt-BR': 'Computadores', es: 'Computadoras', en: 'Desktops' } },
    { slug: 'perifericos', t: { 'pt-BR': 'Periféricos', es: 'Periféricos', en: 'Peripherals' } },
  ],
  eletronicos: [
    { slug: 'televisores', t: { 'pt-BR': 'Televisores', es: 'Televisores', en: 'TVs' } },
    { slug: 'audio', t: { 'pt-BR': 'Áudio', es: 'Audio', en: 'Audio' } },
    { slug: 'camaras', t: { 'pt-BR': 'Câmeras', es: 'Cámaras', en: 'Cameras' } },
  ],
  casa: [
    { slug: 'cocina', t: { 'pt-BR': 'Cozinha', es: 'Cocina', en: 'Kitchen' } },
    { slug: 'muebles', t: { 'pt-BR': 'Móveis', es: 'Muebles', en: 'Furniture' } },
    { slug: 'electrodomesticos', t: { 'pt-BR': 'Eletrodomésticos', es: 'Electrodomésticos', en: 'Appliances' } },
  ],
  moda: [
    { slug: 'ropa', t: { 'pt-BR': 'Roupas', es: 'Ropa', en: 'Clothing' } },
    { slug: 'calzado', t: { 'pt-BR': 'Calçados', es: 'Calzado', en: 'Footwear' } },
  ],
  beleza: [
    { slug: 'perfumes', t: { 'pt-BR': 'Perfumes', es: 'Perfumes', en: 'Fragrances' } },
    { slug: 'maquillaje', t: { 'pt-BR': 'Maquiagem', es: 'Maquillaje', en: 'Makeup' } },
  ],
  esportes: [
    { slug: 'fitness', t: { 'pt-BR': 'Fitness', es: 'Fitness', en: 'Fitness' } },
    { slug: 'bicicletas', t: { 'pt-BR': 'Bicicletas', es: 'Bicicletas', en: 'Bikes' } },
  ],
};

async function main(): Promise<void> {
  const conn = await mariadb.createConnection({ ...dbConfig, allowPublicKeyRetrieval: true });

  for (const p of PLANS) {
    await conn.query(
      `INSERT INTO plan (slug, name, price_monthly, currency, max_products, max_api_requests_per_day)
       VALUES (?, ?, ?, 'PYG', ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), price_monthly=VALUES(price_monthly),
         max_products=VALUES(max_products), max_api_requests_per_day=VALUES(max_api_requests_per_day)`,
      [p.slug, p.name, p.price, p.max_products, p.max_api],
    );
  }
  console.log(`Planos: ${PLANS.length} garantidos.`);

  for (let i = 0; i < CATEGORIES.length; i++) {
    const c = CATEGORIES[i];
    await conn.query(
      `INSERT INTO category (slug, position, icon) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE position=VALUES(position), icon=VALUES(icon)`,
      [c.slug, i, c.icon],
    );
    const [{ id }] = await conn.query('SELECT id FROM category WHERE slug = ?', [c.slug]);
    for (const [locale, name] of Object.entries(c.t)) {
      await conn.query(
        `INSERT INTO category_translation (category_id, locale, name) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name)`,
        [id, locale, name],
      );
    }
  }
  console.log(`Categorias: ${CATEGORIES.length} garantidas (pt-BR/es/en).`);

  let subCount = 0;
  for (const [parentSlug, subs] of Object.entries(SUBCATEGORIES)) {
    const [{ id: parentId }] = await conn.query('SELECT id FROM category WHERE slug = ?', [parentSlug]);
    for (let i = 0; i < subs.length; i++) {
      const s = subs[i];
      await conn.query(
        `INSERT INTO category (slug, parent_id, position) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE parent_id=VALUES(parent_id), position=VALUES(position)`,
        [s.slug, parentId, i],
      );
      const [{ id }] = await conn.query('SELECT id FROM category WHERE slug = ?', [s.slug]);
      for (const [locale, name] of Object.entries(s.t)) {
        await conn.query(
          `INSERT INTO category_translation (category_id, locale, name) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE name=VALUES(name)`,
          [id, locale, name],
        );
      }
      subCount++;
    }
  }
  console.log(`Subcategorias: ${subCount} garantidas (pt-BR/es/en).`);

  await conn.end();
  console.log('Seed concluído.');
}

main().catch((err) => {
  console.error('Falha no seed:', err);
  process.exit(1);
});
