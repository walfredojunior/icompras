import { hashEmbed } from "../embedding/local.js";

// Palavras-semente por categoria-raiz (pt/es/en + marcas comuns).
export const CATEGORY_SEEDS: Record<string, string> = {
  celulares:
    "celular telefono movil smartphone iphone apple samsung galaxy xiaomi redmi motorola nokia huawei phone telefono celular",
  informatica:
    "notebook laptop computadora pc monitor teclado mouse impresora dell lenovo hp asus acer macbook computador informatica",
  eletronicos:
    "televisor tv smart led auricular fone headphone parlante bluetooth camara electronico eletronico electronica",
  casa:
    "casa hogar mueble cocina heladera nevera microondas licuadora aspiradora sofa cama colchon home",
  moda:
    "ropa remera camiseta pantalon zapato zapatilla calzado vestido campera moda fashion",
  beleza:
    "perfume maquillaje shampoo crema belleza cosmetico beauty",
  esportes:
    "deporte pelota bicicleta gimnasio mancuerna futbol running deportivo sport esporte",
};

// Palavras-semente por subcategoria (folhas).
export const SUBCATEGORY_SEEDS: Record<string, string> = {
  smartphones: "smartphone celular telefono movil iphone apple samsung galaxy xiaomi redmi motorola huawei pixel",
  "acessorios-celular": "funda case cargador cable auricular soporte protector vidrio templado power bank accesorio celular",
  notebooks: "notebook laptop macbook portatil ultrabook ideapad thinkpad inspiron",
  computadoras: "computadora pc desktop torre gabinete all in one mac mini imac escritorio",
  perifericos: "teclado mouse impresora monitor webcam parlante microfono periferico",
  televisores: "televisor tv smart led oled qled pantalla television",
  audio: "auricular parlante bluetooth soundbar audio fone headphone caixa de som jbl bocina",
  camaras: "camara fotografica gopro dron drone lente webcam foto video",
  cocina: "cocina heladera nevera microondas licuadora cafetera sarten olla air fryer",
  muebles: "mueble sofa cama mesa silla ropero placard estante escritorio",
  electrodomesticos: "lavarropas lavadora aspiradora plancha ventilador aire acondicionado electrodomestico secadora",
  ropa: "remera camiseta pantalon vestido campera buzo ropa jean short",
  calzado: "zapato zapatilla calzado bota sandalia championes tenis",
  perfumes: "perfume fragancia eau de parfum eau de toilette colonia lattafa",
  maquillaje: "maquillaje base labial rimel mascara sombra cosmetico polvo",
  fitness: "mancuerna pesa colchoneta cinta caminadora gimnasio fitness yoga",
  bicicletas: "bicicleta bici rodado ciclismo mtb bmx",
};

function cosineDistance(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return 1 - dot;
}

export function buildVectors(seeds: Record<string, string>): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [slug, seed] of Object.entries(seeds)) out[slug] = hashEmbed(seed);
  return out;
}

export function buildCategoryVectors(): Record<string, number[]> {
  return buildVectors(CATEGORY_SEEDS);
}

export interface CategorySuggestion {
  slug: string | null;
  distance: number;
}

/** Categoria-raiz mais próxima do texto. */
export function suggestCategory(
  text: string,
  vectors: Record<string, number[]>,
  threshold = 0.92,
): CategorySuggestion {
  return nearestFrom(text, vectors, Object.keys(vectors), threshold);
}

/** Mais próximo dentre um conjunto de candidatos (ex.: as subcategorias de uma raiz). */
export function nearestFrom(
  text: string,
  vectors: Record<string, number[]>,
  candidates: string[],
  threshold = 1,
): CategorySuggestion {
  const v = hashEmbed(text);
  let best: string | null = null;
  let bestDist = Infinity;
  for (const slug of candidates) {
    const cv = vectors[slug];
    if (!cv) continue;
    const d = cosineDistance(v, cv);
    if (d < bestDist) {
      bestDist = d;
      best = slug;
    }
  }
  return { slug: bestDist <= threshold ? best : null, distance: bestDist };
}
