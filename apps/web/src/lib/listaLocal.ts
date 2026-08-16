"use client";

// A LISTA DE DESEJOS MORA NO NAVEGADOR.
//
// Decisão dele em 15/08/2026: *"lista sem cadastro, deixa guardado no
// navegador"*. A pessoa clica em "adicionar à lista" no primeiro segundo de
// visita, sem conta, sem senha, sem e-mail.
//
// 💡 POR QUE ASSIM: a conta foi desligada da vitrine em 31/07 porque o alerta
// de preço — a razão de existir cadastro aqui — nunca funcionou. Exigir
// cadastro para montar lista seria pedir compromisso antes de entregar valor,
// o mesmo erro. Aqui a ordem se inverte: primeiro a lista funciona, depois o
// cadastro aparece como conveniência (não perder, usar em dois aparelhos).

/** Um item da lista. Guardamos o mínimo — o preço vem fresco do servidor. */
export interface ItemDaLista {
  /** id do produto no nosso banco */
  id: number;
  slug: string;
  nome: string;
  imagem: string | null;
  quantidade: number;
  observacao?: string;
  addEm: number;
}

export interface Lista {
  id: string;
  nome: string;
  itens: ItemDaLista[];
  criadaEm: number;
  /** Token do último compartilhamento, se houve. */
  token?: string;
}

const CHAVE = "icompras_listas_v1";
/** Teto por lista. Sem isto, um script encheria o navegador e depois o banco. */
const MAX_ITENS = 100;
const MAX_LISTAS = 20;

/** Avisa a página inteira que a lista mudou (o contador do topo ouve isto). */
export const EVENTO = "icompras:listas";

function avisar() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO));
}

export function lerListas(): Lista[] {
  if (typeof window === "undefined") return [];
  try {
    const cru = window.localStorage.getItem(CHAVE);
    if (!cru) return [];
    const dados = JSON.parse(cru);
    return Array.isArray(dados) ? dados.filter((l) => l && Array.isArray(l.itens)) : [];
  } catch {
    // Guardado corrompido (ou de uma versão futura): começa limpo em vez de
    // quebrar a página. Lista é conveniência, não pode derrubar o site.
    return [];
  }
}

function gravar(listas: Lista[]) {
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(listas.slice(0, MAX_LISTAS)));
    avisar();
  } catch {
    // Espaço do navegador cheio ou modo privado bloqueando. Não dá para
    // salvar, e não há o que fazer além de não quebrar a tela.
  }
}

export function criarLista(nome: string): Lista {
  const listas = lerListas();
  let limpo = nome.trim().slice(0, 60) || "Minha lista";

  // ⚠ NUMERA SE O NOME JÁ EXISTE. Sem isto, o botão "criar nova lista" gerava
  // sempre "Minha lista", e o menu de escolha ficava com quatro opções de nome
  // idêntico — inútil, porque a pessoa não tem como saber qual é qual.
  // Apareceu no primeiro teste do menu, em 16/08/2026.
  if (listas.some((l) => l.nome === limpo)) {
    let n = 2;
    while (listas.some((l) => l.nome === `${limpo} ${n}`)) n++;
    limpo = `${limpo} ${n}`;
  }

  const nova: Lista = {
    // Sem Math.random no id para não colidir em cliques rápidos: o tempo em
    // base 36 mais um contador do tamanho atual já basta e é legível.
    id: `${Date.now().toString(36)}${listas.length}`,
    nome: limpo,
    itens: [],
    criadaEm: Date.now(),
  };
  gravar([...listas, nova]);
  return nova;
}

export function renomearLista(id: string, nome: string) {
  gravar(lerListas().map((l) => (l.id === id ? { ...l, nome: nome.trim().slice(0, 60) || l.nome } : l)));
}

export function apagarLista(id: string) {
  gravar(lerListas().filter((l) => l.id !== id));
}

/**
 * Põe um produto numa lista. Sem lista nenhuma, cria a primeira sozinho —
 * obrigar a pessoa a criar uma lista antes de adicionar o produto é atrito
 * no exato momento em que ela demonstrou interesse.
 */
export function adicionar(produto: Omit<ItemDaLista, "quantidade" | "addEm">, listaId?: string) {
  let listas = lerListas();
  if (!listas.length) {
    listas = [{ id: `${Date.now().toString(36)}0`, nome: "Minha lista", itens: [], criadaEm: Date.now() }];
  }
  const alvo = listas.find((l) => l.id === listaId) ?? listas[0];
  const existente = alvo.itens.find((i) => i.id === produto.id);
  if (existente) {
    existente.quantidade += 1;
  } else {
    if (alvo.itens.length >= MAX_ITENS) return { ok: false, motivo: "cheia" as const };
    alvo.itens.push({ ...produto, quantidade: 1, addEm: Date.now() });
  }
  gravar(listas);
  return { ok: true, lista: alvo };
}

export function mudarQuantidade(listaId: string, produtoId: number, quantidade: number) {
  const q = Math.max(0, Math.min(99, Math.round(quantidade)));
  const listas = lerListas().map((l) => {
    if (l.id !== listaId) return l;
    // Quantidade zero remove: é o que a pessoa espera ao apertar "menos" no
    // último item, e evita item fantasma somando zero na conta.
    const itens = q === 0 ? l.itens.filter((i) => i.id !== produtoId)
                          : l.itens.map((i) => (i.id === produtoId ? { ...i, quantidade: q } : i));
    return { ...l, itens };
  });
  gravar(listas);
}

export function remover(listaId: string, produtoId: number) {
  gravar(lerListas().map((l) => (l.id === listaId ? { ...l, itens: l.itens.filter((i) => i.id !== produtoId) } : l)));
}

export function guardarToken(listaId: string, token: string) {
  gravar(lerListas().map((l) => (l.id === listaId ? { ...l, token } : l)));
}

/** Quantos itens no total — é o número do contador no cabeçalho. */
export function totalDeItens(): number {
  return lerListas().reduce((n, l) => n + l.itens.reduce((s, i) => s + i.quantidade, 0), 0);
}

/** Se este produto já está em alguma lista (para o botão mudar de estado). */
export function estaEmAlguma(produtoId: number): boolean {
  return lerListas().some((l) => l.itens.some((i) => i.id === produtoId));
}

/** Os ids das listas que contêm este produto — o menu marca essas. */
export function listasComOProduto(produtoId: number): string[] {
  return lerListas().filter((l) => l.itens.some((i) => i.id === produtoId)).map((l) => l.id);
}

/**
 * Põe ou tira o produto de uma lista específica.
 *
 * ⚠ POR QUE ISTO EXISTE (16/08/2026). O botão chamava `adicionar(produto)` sem
 * dizer a lista, e a função caía em `listas[0]` — **o produto ia sempre para a
 * primeira lista criada**, sem a pessoa escolher nem ficar sabendo. Com uma
 * lista só ninguém nota; com duas, o comportamento fica errado e invisível.
 * O dono perguntou e estava certo.
 */
export function alternarNaLista(
  listaId: string,
  produto: Omit<ItemDaLista, "quantidade" | "addEm">,
): { dentro: boolean } {
  const listas = lerListas();
  const alvo = listas.find((l) => l.id === listaId);
  if (!alvo) return { dentro: false };

  const i = alvo.itens.findIndex((x) => x.id === produto.id);
  if (i >= 0) {
    alvo.itens.splice(i, 1);
    gravar(listas);
    return { dentro: false };
  }
  if (alvo.itens.length >= MAX_ITENS) return { dentro: false };
  alvo.itens.push({ ...produto, quantidade: 1, addEm: Date.now() });
  gravar(listas);
  return { dentro: true };
}
