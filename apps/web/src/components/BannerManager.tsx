"use client";

import { useState, useEffect } from "react";
import { hoje, fimDoPeriodo } from "@/lib/datas";
import { useRouter } from "@/i18n/navigation";
import { tipoEquivalente, type DestinoTipo } from "@/lib/bannerDestino";
import { EscolherCategoria, type CatOpcao, type Ocupadas } from "./EscolherCategoria";
import { Search, X, Plus } from "lucide-react";

type Cat = CatOpcao;

export interface LinhaPreco {
  id: number;
  servico: string;
  slot: string | null;
  faixa: string | null;
  valor_mensal: number;
  valor_trimestral: number | null;
  valor_semestral: number | null;
  ativo: number;
}
interface Store {
  id: number;
  name: string;
  /** Já tem produto no catálogo? Só informativo — não impede ser cliente. */
  temProduto?: boolean;
  /** É cliente de verdade, ou ainda é um lead trazido pelo coletor? */
  ehCliente?: boolean;
}
interface BannerRow {
  id: number;
  title: string | null;
  image_url: string;
  link_url: string | null;
  destino_tipo: string | null;
  busca: string | null;
  placement: string;
  category_slug: string | null;
  is_paid: number;
  active: number;
  store_id?: number | null;
  store_name?: string | null;
  store_slug?: string | null;
  cliques30?: number;
  starts_at?: string | null;
  ends_at?: string | null;
  slot?: string | null;
  cidade?: string | null;
  pedido_numero?: string | null;
  pedido_valor?: number | null;
}

// Os campos que o formulário mexe. Mesmo conjunto para criar e para editar.
interface Rascunho {
  title: string;
  link_url: string;
  destino_tipo: DestinoTipo;
  busca: string;
  image_url: string;
  placement: string;
  category_slug: string;
  store_id: string;
  is_paid: boolean;
  /** Período contratado, no formato aaaa-mm-dd. Vazio = sem limite. */
  starts_at: string;
  ends_at: string;
  /** Onde na página: topo, meio ou fim da lista. */
  slot: string;
  /** Cidade do restaurante (só para "Onde comer"). */
  cidade: string;
  /** Quanto vai ser cobrado por este banner. Vazio = não lança na conta. */
  valor: string;
  /** Por quanto tempo: decide qual preço da tabela usar. */
  duracao: string;
}

const ROTULOS: Record<DestinoTipo, string> = {
  busca: "Busca pronta (uma frase)",
  marca: "Todos os produtos de uma marca",
  loja: "Página de uma loja no iCompras",
  link: "Endereço externo (site do anunciante)",
  nenhum: "Nenhum — só imagem, sem clique",
  auto: "Modo antigo (link, senão loja)",
};

const ID_LISTA_MARCAS = "marcas-do-catalogo";

/**
 * O PREÇO DE TABELA daquele espaço naquela categoria.
 *
 * ⚠ POR QUE APARECE AQUI (21/08/2026). Ele pediu "poder fazer uma lista de
 * preço e na hora de definir o preço da divulgação ter uma lista ali". Este é o
 * "ali": na hora de montar o banner, antes de falar o valor para o cliente.
 *
 * 💡 A faixa é deduzida do TAMANHO da categoria — perfume tem 30 mil produtos e
 * abajur tem dezenas; cobrar igual seria perder dinheiro num caso e afugentar
 * cliente no outro.
 */
function PrecoSugerido({
  categoria,
  slot,
  precos,
}: {
  categoria?: Cat;
  slot: string;
  precos: LinhaPreco[];
}) {
  if (!categoria) return null;
  const faixa = categoria.produtos >= 3000 ? "grande" : categoria.produtos >= 500 ? "media" : "pequena";
  const linha = precos.find(
    (p) => p.servico === "banner_categoria" && p.slot === slot && p.faixa === faixa && p.ativo,
  );
  const nomeFaixa = faixa === "grande" ? "categoria grande" : faixa === "media" ? "categoria média" : "categoria pequena";
  if (!linha) {
    return (
      <p className="mt-2 text-xs text-slate-400">
        Sem preço cadastrado para {nomeFaixa} · {slot}. Defina em Admin › Tabela de preços.
      </p>
    );
  }
  const dol = (v: number | null) =>
    v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "USD" });
  return (
    <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
      <strong className="text-slate-800">Preço de tabela</strong> · {nomeFaixa} (
      {categoria.produtos.toLocaleString("pt-BR")} produtos)
      <br />
      mês {dol(linha.valor_mensal)} · trimestre {dol(linha.valor_trimestral)} · semestre{" "}
      {dol(linha.valor_semestral)}
    </p>
  );
}

/** Data do banco (ou vazia) no formato aaaa-mm-dd que o campo de data entende. */
function soData(v: string | null | undefined): string {
  if (!v) return "";
  return String(v).slice(0, 10);
}

/** dd/mm/aaaa para ler. */
function dataBonita(v: string | null | undefined): string {
  const d = soData(v);
  if (!d) return "";
  const [a, m, dia] = d.split("-");
  return `${dia}/${m}/${a}`;
}

/**
 * Dois períodos se cruzam? Data vazia vale "sem limite".
 *
 * ⚠ É A MESMA REGRA DO SERVIDOR (`categoriaOcupadaPor` em lib/banners.ts), de
 * propósito: aqui ela AVISA enquanto se digita, lá ela RECUSA. A tela sozinha
 * não basta — dois navegadores abertos ao mesmo tempo furariam a trava.
 */
function cruzam(iniA: string, fimA: string, iniB: string, fimB: string): boolean {
  const a1 = iniA || "1000-01-01";
  const a2 = fimA || "9999-12-31";
  const b1 = iniB || "1000-01-01";
  const b2 = fimB || "9999-12-31";
  return a1 <= b2 && a2 >= b1;
}

/**
 * O aviso de "essa categoria já está ocupada".
 *
 * 💡 NÃO impede de escolher, e isso é de propósito: escolher uma categoria
 * ocupada é legítimo quando se está vendendo o período SEGUINTE. O aviso mostra
 * até quando está ocupada e só vira erro se as datas se cruzarem de fato.
 */
function AvisoOcupada({
  slug,
  slot,
  inicio,
  fim,
  banners,
  ignorarId,
}: {
  slug: string;
  slot: string;
  inicio: string;
  fim: string;
  banners: BannerRow[];
  ignorarId: number | null;
}) {
  if (!slug) return null;
  // ⚠ Compara CATEGORIA + ESPAÇO: topo, meio e fim são vendidos separados, e o
  // topo de perfume estar ocupado não impede vender o meio no mesmo mês.
  const mesmoEspaco = (b: BannerRow) =>
    b.placement === "category" && b.category_slug === slug && (b.slot ?? "topo") === slot;
  const conflitos = banners.filter(
    (b) => mesmoEspaco(b) && b.id !== ignorarId && cruzam(inicio, fim, soData(b.starts_at), soData(b.ends_at)),
  );
  const outros = banners.filter(
    (b) => mesmoEspaco(b) && b.id !== ignorarId && !conflitos.includes(b),
  );

  if (conflitos.length > 0) {
    const c = conflitos[0];
    return (
      <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
        <strong>Categoria já ocupada nesse período.</strong>
        <br />
        &quot;{c.title || c.store_name || `banner ${c.id}`}&quot;
        {soData(c.ends_at)
          ? ` está no ar até ${dataBonita(c.ends_at)}.`
          : " está no ar sem data de término."}
        <br />
        {soData(c.ends_at)
          ? `Para vender o período seguinte, comece em ${dataBonita(
              new Date(new Date(soData(c.ends_at)).getTime() + 86400000).toISOString(),
            )} ou depois.`
          : "Ponha uma data de término no banner atual antes de vender outro."}
      </p>
    );
  }
  if (outros.length > 0) {
    const o = outros[0];
    return (
      <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Essa categoria tem outro banner (&quot;{o.title || `banner ${o.id}`}&quot;
        {soData(o.ends_at) ? `, até ${dataBonita(o.ends_at)}` : ""}), mas em período diferente —
        os dois podem conviver.
      </p>
    );
  }
  return (
    <p className="mt-2 text-xs text-brand-green">✓ Categoria livre nesse período.</p>
  );
}

// Quantos produtos essa busca acha agora.
//
// Sem isto, o único jeito de descobrir que um banner leva a uma página vazia
// era publicar e reparar depois. Espera 400ms de silêncio para não disparar uma
// consulta por letra digitada.
function PreviaBusca({ tipo, valor }: { tipo: DestinoTipo; valor: string }) {
  const [total, setTotal] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const termo = valor.trim();
    if (!termo) {
      setTotal(null);
      return;
    }
    setCarregando(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/admin/banners/previa?tipo=${tipo}&valor=${encodeURIComponent(termo)}`,
        );
        const j = await r.json();
        setTotal(typeof j.total === "number" ? j.total : null);
      } catch {
        setTotal(null);
      }
      setCarregando(false);
    }, 400);
    return () => clearTimeout(t);
  }, [tipo, valor]);

  if (!valor.trim()) return null;
  if (carregando) return <span className="text-xs text-slate-400">conferindo…</span>;
  if (total === null) return null;
  if (total === 0) {
    return (
      <span className="text-xs font-medium text-red-600">
        nenhum produto encontrado — o banner levaria a uma página vazia
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-brand-green-dark">
      encontra {total.toLocaleString("pt-BR")} produto{total === 1 ? "" : "s"}
    </span>
  );
}

// O bloco "para onde o clique leva", igual nos dois formulários.
function CamposDeDestino({
  d,
  set,
  stores,
}: {
  d: Rascunho;
  set: (r: Rascunho) => void;
  stores: Store[];
}) {
  const campo = "rounded-lg border border-slate-300 px-3 py-2 text-sm";
  const tipo = d.destino_tipo;

  return (
    <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <label className="text-sm font-medium text-slate-700">
        Para onde o clique leva?
        <select
          value={tipo}
          onChange={(e) => set({ ...d, destino_tipo: e.target.value as DestinoTipo })}
          className={`mt-1 block w-full ${campo}`}
        >
          {(["busca", "marca", "loja", "link", "nenhum"] as DestinoTipo[]).map((t) => (
            <option key={t} value={t}>
              {ROTULOS[t]}
            </option>
          ))}
        </select>
      </label>

      {tipo === "busca" && (
        <div className="mt-2">
          <input
            value={d.busca}
            onChange={(e) => set({ ...d, busca: e.target.value })}
            placeholder="o que procurar — ex.: perfume masculino"
            className={`block w-full ${campo}`}
          />
          <div className="mt-1 flex items-center gap-2">
            <PreviaBusca tipo="busca" valor={d.busca} />
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Abre a busca do site já preenchida. Boa para frases: “iphone 17 pro”, “perfume
            importado”.
          </p>
        </div>
      )}

      {tipo === "marca" && (
        <div className="mt-2">
          <input
            value={d.busca}
            onChange={(e) => set({ ...d, busca: e.target.value })}
            list={ID_LISTA_MARCAS}
            placeholder="comece a digitar a marca — ex.: Apple"
            className={`block w-full ${campo}`}
          />
          <div className="mt-1 flex items-center gap-2">
            <PreviaBusca tipo="marca" valor={d.busca} />
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Traz <strong>exatamente</strong> os produtos da marca — mais preciso que a frase, que
            também pegaria capinhas “para Apple”. Escolha um nome da lista: o texto tem que bater
            com o do catálogo.
          </p>
        </div>
      )}

      {tipo === "loja" && (
        <p className="mt-2 text-xs text-slate-500">
          Vai para a página da loja escolhida em <strong>“Loja deste banner”</strong>, aqui embaixo.
          {!d.store_id && <span className="font-medium text-red-600"> Escolha uma loja.</span>}
        </p>
      )}

      {tipo === "link" && (
        <div className="mt-2">
          <input
            value={d.link_url}
            onChange={(e) => set({ ...d, link_url: e.target.value })}
            placeholder="https://site-do-anunciante.com"
            className={`block w-full ${campo}`}
          />
          <p className="mt-1 text-xs text-slate-400">Sai do iCompras: abre numa aba nova.</p>
        </div>
      )}

      {tipo === "nenhum" && (
        <p className="mt-2 text-xs text-slate-400">O banner aparece, mas não é clicável.</p>
      )}

      {/* ⚠ A LOJA SAIU DAQUI (22/08/2026) e virou "Cliente" no bloco de cobrança.
          Havia DOIS campos para a mesma coisa em lugares distantes, e o de
          baixo ficava depois do bloco de preço — escolher a loja aqui fazia o
          campo de valor nascer fora da vista, lá em cima.
          💡 Quando o destino é "página de uma loja", é o mesmo `store_id`: quem
          paga pelo banner é quem ele divulga, no caso normal. */}
      {tipo === "loja" && !d.store_id && (
        <p className="mt-2 text-xs text-amber-700">
          Escolha o cliente no bloco &quot;Quem paga por este espaço&quot; — é a loja para onde este
          banner vai levar.
        </p>
      )}
    </div>
  );
}

// Como a linha da lista descreve o destino, por extenso.
function descreverDestino(b: BannerRow): string {
  switch ((b.destino_tipo ?? "auto") as DestinoTipo) {
    case "busca":
      return `→ busca por «${b.busca}»`;
    case "marca":
      return `→ todos os produtos da marca ${b.busca}`;
    case "loja":
      return b.store_name ? `→ página da loja ${b.store_name}` : "→ loja não escolhida (sem clique)";
    case "link":
      return `→ ${b.link_url}`;
    case "nenhum":
      return "→ sem clique";
    default:
      // Cadastrado antes desta tela: o destino ainda é o adivinhado.
      return b.link_url
        ? `→ ${b.link_url} (modo antigo)`
        : b.store_name
          ? `→ página da loja ${b.store_name} (modo antigo)`
          : "→ sem clique (modo antigo)";
  }
}

const VAZIO: Rascunho = {
  title: "",
  link_url: "",
  destino_tipo: "busca",
  busca: "",
  image_url: "",
  placement: "home_hero",
  category_slug: "",
  store_id: "",
  is_paid: false,
  starts_at: "",
  ends_at: "",
  slot: "topo",
  cidade: "",
  valor: "",
  duracao: "mensal",
};

export function BannerManager({
  banners,
  categories,
  stores,
  marcas,
  precos,
}: {
  banners: BannerRow[];
  categories: Cat[];
  stores: Store[];
  marcas: string[];
  precos: LinhaPreco[];
}) {
  const router = useRouter();
  const [novo, setNovo] = useState<Rascunho>({
    ...VAZIO,
    category_slug: categories[0]?.slug ?? "",
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [movendo, setMovendo] = useState<number | null>(null);
  const [editando, setEditando] = useState<number | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Aviso que NÃO é erro: a arte subiu, mas foi recortada para caber no espaço.
  const [aviso, setAviso] = useState<string | null>(null);
  // ⚠ O FORMULÁRIO COMEÇA FECHADO (21/08/2026). Ele abria escancarado no topo,
  // com uma dúzia de campos, e a LISTA — que é o que se consulta todo dia —
  // ficava embaixo de tudo. Quem entra aqui quer ver o que está no ar; criar é
  // a exceção, não a regra.
  const [criando, setCriando] = useState(false);

  // ⚠ Hoje só depois de montar, no navegador — o servidor está em UTC e ele no
  // Paraguai (-3). Ver lib/datas.ts.
  useEffect(() => {
    setNovo((n) => (n.starts_at ? n : { ...n, starts_at: hoje() }));
  }, []);
  // O banner que acabou de nascer e ainda não foi lançado na conta.
  const [recemCriado, setRecemCriado] = useState<{ id: number; titulo: string; loja: string } | null>(
    null,
  );
  // Filtros da lista (pedido dele em 21/08/2026: "poder procurar escrevendo em
  // um search por título ou por loja, e filtro pronto por tipo de banner").
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");

  // Quem ocupa cada categoria hoje — para o cadeado na lista e para o aviso.
  const ocupadas: Ocupadas = {};
  for (const b of banners) {
    if (b.placement !== "category" || !b.category_slug) continue;
    if (ocupadas[b.category_slug]) continue;
    ocupadas[b.category_slug] = {
      titulo: b.title || b.store_name || `banner ${b.id}`,
      ate: b.ends_at ?? null,
    };
  }

  // ⚠ O TAMANHO DA ARTE MUDA POR ESPAÇO. O topo é um cartaz; meio e fim são
  // faixas baixas, para não empurrarem os produtos da lista para baixo. Quem
  // vende precisa saber o que pedir ao anunciante ANTES de receber a arte.
  const ESPACOS: Array<{ id: string; rotulo: string; ajuda: string; arte: string; desenho: string }> = [
    {
      id: "topo",
      rotulo: "1 · Topo",
      ajuda: "antes do primeiro produto — o mais visto, e o mais caro",
      arte: "858 × 375",
      desenho: "acima de tudo, antes da lista começar",
    },
    {
      id: "meio",
      rotulo: "2 · Meio",
      ajuda: "faixa fina, depois do 12º produto",
      arte: "818 × 137",
      desenho: "no meio da lista, depois de 12 produtos",
    },
    {
      id: "fim",
      rotulo: "3 · Fim",
      ajuda: "faixa fina, depois do último produto",
      arte: "818 × 137",
      desenho: "no fim da lista, antes da paginação",
    },
  ];
  const arteDoEspaco = (slot: string) => ESPACOS.find((e) => e.id === slot)?.arte ?? "858 × 375";

  /**
   * O preço de tabela para o que está sendo montado agora.
   *
   * 💡 A faixa sai do TAMANHO da categoria (o mesmo corte do servidor: 3.000+
   * é grande, 500+ é média). Fora de categoria, procura o serviço direto —
   * "Onde comer" e banner de home têm preço único.
   */
  function precoDeTabela(d: Rascunho, duracao: string): number | null {
    let linha: LinhaPreco | undefined;
    if (d.placement === "category") {
      const cat = categories.find((c) => c.slug === d.category_slug);
      if (!cat) return null;
      const faixa = cat.produtos >= 3000 ? "grande" : cat.produtos >= 500 ? "media" : "pequena";
      linha = precos.find(
        (p) => p.servico === "banner_categoria" && p.slot === d.slot && p.faixa === faixa && p.ativo,
      );
    } else if (d.placement === "home_hero") {
      linha = precos.find((p) => p.servico === "banner_home" && p.ativo);
    } else if (d.placement === "restaurante") {
      linha = precos.find((p) => p.servico === "outro" && p.ativo);
    }
    if (!linha) return null;
    if (duracao === "trimestral" && linha.valor_trimestral != null) return linha.valor_trimestral;
    if (duracao === "semestral" && linha.valor_semestral != null) return linha.valor_semestral;
    if (duracao === "avulso") return null;
    return linha.valor_mensal;
  }

  /**
   * Envia a arte JÁ AJUSTADA ao formato do espaço.
   *
   * ⚠ O site tem DOIS formatos (21/08/2026): 858×375 para o banner padrão e
   * 818×137 para a faixa fina do meio/fim da lista. O anunciante manda a arte
   * no tamanho que tem; sem ajuste, ela aparecia cortada de qualquer jeito pelo
   * navegador e só se descobria depois de publicado.
   */
  async function enviarImagem(file: File, espaco: string, lugar: string): Promise<string | null> {
    setUploading(true);
    setErr(null);
    setAviso(null);
    const fd = new FormData();
    fd.append("file", file);
    // Só o meio e o fim de uma categoria usam a faixa fina.
    fd.append("formato", lugar === "category" && espaco !== "topo" ? "faixa" : "padrao");
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const j = await res.json().catch(() => ({}));
    setUploading(false);
    if (res.ok && j.url) {
      if (j.ajustada && j.original && j.formato) {
        setAviso(`A arte veio em ${j.original} e foi ajustada para ${j.formato} (recorte pelo centro).`);
      }
      return j.url as string;
    }
    setErr(j.error ?? "Falha no upload");
    return null;
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await enviarImagem(file, novo.slot, novo.placement);
    if (url) setNovo((n) => ({ ...n, image_url: url }));
  }

  // Mesma checagem que a API faz, só que antes de mandar — assim o erro
  // aparece no campo e não como mensagem depois de salvar.
  function faltando(d: Rascunho): string | null {
    // No vídeo flutuante a capa vem do próprio YouTube (um quadro recente da
    // transmissão), então a imagem é opcional — só vale como reserva quando o
    // endereço é de canal, que não tem capa.
    if (d.placement === "video_flutuante") {
      if (!d.link_url?.trim()) return "Cole o endereço do vídeo no YouTube.";
      return null;
    }
    if (!d.image_url) return "Envie ou informe uma imagem.";
    if ((d.destino_tipo === "busca" || d.destino_tipo === "marca") && !d.busca.trim())
      return "Escreva o que a busca deve procurar.";
    if (d.destino_tipo === "loja" && !d.store_id) return "Escolha a loja de destino.";
    if (d.destino_tipo === "link" && !d.link_url.trim()) return "Informe o endereço do link.";
    if (d.starts_at && d.ends_at && d.starts_at > d.ends_at)
      return "A data de término é anterior à de início.";
    if (d.placement === "category" && !d.category_slug) return "Escolha a categoria.";
    return null;
  }

  /**
   * A trava de exclusividade, antes de mandar ao servidor.
   *
   * ⚠ Isto NÃO substitui a conferência do servidor — só a antecipa, para o erro
   * aparecer no formulário em vez de virar mensagem depois de salvar. Duas
   * janelas abertas ao mesmo tempo furariam esta; a do servidor é que segura.
   */
  function categoriaEmConflito(d: Rascunho, ignorarId: number | null): string | null {
    if (d.placement !== "category" || !d.category_slug) return null;
    const c = banners.find(
      (b) =>
        b.placement === "category" &&
        b.category_slug === d.category_slug &&
        (b.slot ?? "topo") === d.slot &&
        b.id !== ignorarId &&
        cruzam(d.starts_at, d.ends_at, soData(b.starts_at), soData(b.ends_at)),
    );
    if (!c) return null;
    const nome = c.title || c.store_name || `banner ${c.id}`;
    const ate = soData(c.ends_at) ? ` (no ar até ${dataBonita(c.ends_at)})` : " (sem data de término)";
    return `Essa categoria já está ocupada por "${nome}"${ate}. Escolha outro período ou outra categoria.`;
  }

  function corpo(d: Rascunho) {
    return {
      title: d.title || null,
      image_url: d.image_url,
      link_url: d.link_url || null,
      destino_tipo: d.destino_tipo,
      busca: d.busca || null,
      placement: d.placement,
      category_slug: d.placement === "category" ? d.category_slug : null,
      is_paid: d.is_paid,
      store_id: d.store_id ? Number(d.store_id) : null,
      starts_at: d.starts_at || null,
      ends_at: d.ends_at || null,
      slot: d.placement === "category" ? d.slot : null,
      cidade: d.placement === "restaurante" ? d.cidade.trim() || null : null,
      // ⚠ O VALOR VIAJA JUNTO COM O BANNER (22/08/2026). Ele perguntou: "não
      // era melhor ali no banner, se eu colocar o cliente tem também o valor e
      // ele já entrar no contas a receber?". Estava certo — antes eram dois
      // passos (criar o banner, depois clicar em "lançar na conta"), e o
      // segundo era fácil de esquecer: 9 banners de teste ficaram no ar sem
      // cobrança nenhuma.
      valor: d.valor ? Number(d.valor) : null,
      duracao: d.duracao || "mensal",
    };
  }

  /**
   * Lança este banner na conta do cliente, com o preço de tabela.
   *
   * 💡 O item nasce do banner: categoria, espaço, período e loja vêm copiados,
   * e fica o vínculo. É o que faltava para as duas telas se falarem.
   */
  async function lancarNaConta(b: BannerRow) {
    if (!b.store_id) {
      setErr("Este banner não está ligado a nenhuma loja. Escolha a loja no banner primeiro.");
      return;
    }
    setSaving(true);
    setErr(null);
    const res = await fetch("/api/admin/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "lancar_banner", banner_id: b.id }),
    });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setErr(j.error ?? "Não deu certo.");
      return;
    }
    router.refresh();
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const problema = faltando(novo) ?? categoriaEmConflito(novo, null);
    if (problema) {
      setErr(problema);
      return;
    }
    setSaving(true);
    setErr(null);
    const res = await fetch("/api/admin/banners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo(novo)),
    });
    setSaving(false);
    if (res.ok) {
      const j = await res.json().catch(() => ({}));
      // ⚠ FECHA A VENDA AQUI (21/08/2026). Antes era preciso criar o banner,
      // voltar para a lista, achar a linha e clicar em "lançar na conta" — três
      // passos para uma coisa só. Se o banner é pago e tem loja, a oferta
      // aparece agora, com o preço de tabela já calculado.
      if (j.id && novo.is_paid && novo.store_id) {
        setRecemCriado({
          id: Number(j.id),
          titulo: novo.title || `banner ${j.id}`,
          loja: stores.find((s) => String(s.id) === novo.store_id)?.name ?? "",
        });
      }
      setNovo({ ...VAZIO, category_slug: categories[0]?.slug ?? "" });
      setCriando(false);
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "Erro");
    }
  }

  async function toggle(id: number, active: number) {
    await fetch(`/api/admin/banners/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    router.refresh();
  }
  async function remove(id: number) {
    await fetch(`/api/admin/banners/${id}`, { method: "DELETE" });
    router.refresh();
  }

  // --- edição de um banner já criado -----------------------------------------
  function abrirEdicao(b: BannerRow) {
    setEditando(b.id);
    setRascunho({
      title: b.title ?? "",
      link_url: b.link_url ?? "",
      // Banner antigo abre já na opção equivalente à que ele usa hoje: salvar
      // o converte para o modo explícito, sem mudar para onde ele leva.
      destino_tipo: tipoEquivalente(b),
      busca: b.busca ?? "",
      image_url: b.image_url,
      placement: b.placement,
      category_slug: b.category_slug ?? categories[0]?.slug ?? "",
      store_id: b.store_id ? String(b.store_id) : "",
      is_paid: !!b.is_paid,
      starts_at: soData(b.starts_at),
      ends_at: soData(b.ends_at),
      slot: b.slot ?? "topo",
      cidade: b.cidade ?? "",
      // Na edição o valor fica em branco de propósito: o que já foi cobrado
      // está guardado no item de venda, e reescrevê-lo aqui mudaria o passado.
      valor: "",
      duracao: "mensal",
    });
    setErr(null);
  }

  async function trocarImagem(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !rascunho) return;
    const url = await enviarImagem(file, rascunho.slot, rascunho.placement);
    if (url) setRascunho({ ...rascunho, image_url: url });
  }

  async function salvarEdicao(id: number) {
    if (!rascunho) return;
    const problema = faltando(rascunho) ?? categoriaEmConflito(rascunho, id);
    if (problema) {
      setErr(problema);
      return;
    }
    setSaving(true);
    setErr(null);
    const res = await fetch(`/api/admin/banners/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ edit: corpo(rascunho) }),
    });
    setSaving(false);
    if (res.ok) {
      setEditando(null);
      setRascunho(null);
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "Erro ao salvar");
    }
  }

  async function mover(id: number, move: "up" | "down") {
    setMovendo(id);
    await fetch(`/api/admin/banners/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ move }),
    });
    router.refresh();
    setMovendo(null);
  }

  // A ordem só faz sentido dentro do mesmo espaço: o banner do topo da home não
  // disputa lugar com o de uma categoria. Aqui descubro, para cada linha, se ela
  // é a primeira ou a última do seu grupo — é o que desliga a setinha na ponta.
  const chave = (b: BannerRow) => `${b.placement}|${b.category_slug ?? ""}`;
  const posicaoNoGrupo = new Map<number, { primeiro: boolean; ultimo: boolean }>();
  {
    const porGrupo = new Map<string, BannerRow[]>();
    for (const b of banners) {
      const k = chave(b);
      if (!porGrupo.has(k)) porGrupo.set(k, []);
      porGrupo.get(k)!.push(b);
    }
    for (const lista of porGrupo.values()) {
      lista.forEach((b, i) =>
        posicaoNoGrupo.set(b.id, { primeiro: i === 0, ultimo: i === lista.length - 1 }),
      );
    }
  }

  // ---------------------------------------------------------------- filtros
  //
  // 💡 Filtra em memória, e não no servidor: são poucos banners (dezenas, não
  // milhares), e assim a lista responde a cada letra digitada sem recarregar.
  // Se um dia passar de umas centenas, isto vira consulta no banco.
  const seteDias = new Date();
  seteDias.setDate(seteDias.getDate() + 7);

  function venceEmBreve(b: BannerRow): boolean {
    if (!b.ends_at) return false;
    const fim = new Date(b.ends_at);
    return fim >= new Date() && fim <= seteDias;
  }

  const contagem = {
    todos: banners.length,
    home_hero: banners.filter((b) => b.placement === "home_hero").length,
    category: banners.filter((b) => b.placement === "category").length,
    video_flutuante: banners.filter((b) => b.placement === "video_flutuante").length,
    vencendo: banners.filter(venceEmBreve).length,
  };

  const bannersVisiveis = banners.filter((b) => {
    if (filtroTipo === "vencendo") {
      if (!venceEmBreve(b)) return false;
    } else if (filtroTipo !== "todos" && b.placement !== filtroTipo) {
      return false;
    }
    const termo = filtroTexto.trim().toLowerCase();
    if (!termo) return true;
    // Procura no título E no nome da loja — foi o que ele pediu. A categoria
    // entra de brinde: digitar "perfume" acha o banner daquela categoria mesmo
    // que o título não diga isso.
    return (
      (b.title ?? "").toLowerCase().includes(termo) ||
      (b.store_name ?? "").toLowerCase().includes(termo) ||
      (b.category_slug ?? "").toLowerCase().includes(termo)
    );
  });

  const ABAS: { id: string; rotulo: string; n: number }[] = [
    { id: "todos", rotulo: "Todos", n: contagem.todos },
    { id: "home_hero", rotulo: "Home (carrossel)", n: contagem.home_hero },
    { id: "category", rotulo: "Categoria", n: contagem.category },
    { id: "video_flutuante", rotulo: "Vídeo flutuante", n: contagem.video_flutuante },
    { id: "vencendo", rotulo: "Vencendo em 7 dias", n: contagem.vencendo },
  ];

  const campo = "rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <div>
      {/* Lista de marcas do catálogo, usada pelos dois formulários. O navegador
          sugere sozinho enquanto se digita — com centenas de marcas, uma caixa
          de seleção comum seria impossível de percorrer no celular. */}
      <datalist id={ID_LISTA_MARCAS}>
        {marcas.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>

      {recemCriado && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-green bg-brand-green-light px-4 py-3">
          <div className="text-sm">
            <p className="font-semibold text-brand-green-dark">
              Banner criado: {recemCriado.titulo}
            </p>
            <p className="text-xs text-slate-600">
              Falta lançar na conta de {recemCriado.loja} — o preço vem da tabela.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                const b = banners.find((x) => x.id === recemCriado.id);
                if (b) await lancarNaConta(b);
                setRecemCriado(null);
              }}
              disabled={saving}
              className="rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            >
              Lançar na conta
            </button>
            <button
              onClick={() => setRecemCriado(null)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-600"
            >
              agora não
            </button>
          </div>
        </div>
      )}

      {!criando && (
        <button
          onClick={() => setCriando(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-green-dark"
        >
          <Plus className="h-4 w-4" /> Novo banner
        </button>
      )}

      {criando && (
      <form onSubmit={create} className="grid gap-3 rounded-2xl border border-slate-200 p-4 sm:grid-cols-2">
        <div className="flex items-center justify-between sm:col-span-2">
          <h2 className="text-sm font-semibold text-slate-800">Novo banner</h2>
          <button
            type="button"
            onClick={() => {
              setCriando(false);
              setErr(null);
              setAviso(null);
            }}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            cancelar
          </button>
        </div>
        <input
          value={novo.title}
          onChange={(e) => setNovo({ ...novo, title: e.target.value })}
          placeholder="Título (opcional)"
          className={campo}
        />

        <CamposDeDestino d={novo} set={setNovo} stores={stores} />

        <label className="text-sm text-slate-600">
          Onde aparece
          <select
            value={novo.placement}
            onChange={(e) => setNovo({ ...novo, placement: e.target.value })}
            className={`mt-1 block w-full ${campo}`}
          >
            <option value="home_hero">Topo da home (carrossel)</option>
            <option value="category">Páginas de categoria e busca</option>
            <option value="video_flutuante">Vídeo flutuante na home (ao vivo)</option>
            <option value="restaurante">Onde comer no Paraguai (home)</option>
          </select>
        </label>

        {/* CIDADE — só para restaurante. Guardada desde o primeiro cadastro
            mesmo sem uso imediato: quem vai a Ciudad del Este não almoça em
            Salto del Guairá, e quando houver restaurantes demais a faixa vai
            precisar filtrar. Acrescentar a coluna depois obrigaria a voltar em
            cada cadastro para preencher à mão. */}
        {novo.placement === "restaurante" && (
          <label className="text-sm text-slate-600">
            Cidade
            <input
              value={novo.cidade}
              onChange={(e) => setNovo({ ...novo, cidade: e.target.value })}
              placeholder="Ciudad del Este, Salto del Guairá…"
              className={`mt-1 block w-full ${campo}`}
            />
          </label>
        )}

        {novo.placement === "category" && (
          <div className="text-sm text-slate-600">
            Categoria
            <div className="mt-1">
              <EscolherCategoria
                categorias={categories}
                valor={novo.category_slug}
                onChange={(slug) => setNovo({ ...novo, category_slug: slug })}
                ocupadas={ocupadas}
              />
            </div>
            {/* OS TRÊS ESPAÇOS — a mesma categoria tem TRÊS lugares vendáveis,
                e cada um só aceita um banner por período. O desenho ao lado
                existe porque "topo/meio/fim" não diz nada sozinho: só olhando a
                página se entende onde cada um cai. */}
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-semibold text-slate-700">
                Em que parte da página este banner aparece
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ESPACOS.map((e) => {
                  const ocupado = banners.some(
                    (b) =>
                      b.placement === "category" &&
                      b.category_slug === novo.category_slug &&
                      (b.slot ?? "topo") === e.id &&
                      cruzam(novo.starts_at, novo.ends_at, soData(b.starts_at), soData(b.ends_at)),
                  );
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setNovo({ ...novo, slot: e.id })}
                      title={e.ajuda}
                      className={`rounded-full px-3 py-1 text-xs transition ${
                        novo.slot === e.id
                          ? "bg-brand-navy font-semibold text-white"
                          : ocupado
                            ? "bg-red-50 text-red-700 ring-1 ring-red-200 hover:bg-red-100"
                            : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {e.rotulo}
                      {ocupado && " · ocupado"}
                    </button>
                  );
                })}
              </div>

              {/* O desenho da página, com a posição escolhida acesa. */}
              <div className="mt-3 flex gap-3">
                <div className="w-24 shrink-0 space-y-1 rounded-lg border border-slate-200 bg-white p-1.5">
                  <div
                    className={`h-4 rounded ${novo.slot === "topo" ? "bg-brand-navy" : "bg-slate-200"}`}
                  />
                  <div className="grid grid-cols-3 gap-0.5">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-2.5 rounded-sm bg-slate-100" />
                    ))}
                  </div>
                  <div
                    className={`h-1.5 rounded ${novo.slot === "meio" ? "bg-brand-navy" : "bg-slate-200"}`}
                  />
                  <div className="grid grid-cols-3 gap-0.5">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-2.5 rounded-sm bg-slate-100" />
                    ))}
                  </div>
                  <div
                    className={`h-1.5 rounded ${novo.slot === "fim" ? "bg-brand-navy" : "bg-slate-200"}`}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  {ESPACOS.find((e) => e.id === novo.slot)?.desenho}
                  <br />
                  <span className="text-slate-400">
                    Cada categoria tem estas três posições, e cada uma aceita{" "}
                    <strong>um banner por período</strong>. Dá para vender as três para lojas
                    diferentes no mesmo mês.
                  </span>
                </p>
              </div>
            </div>
            <AvisoOcupada
              slug={novo.category_slug}
              slot={novo.slot}
              inicio={novo.starts_at}
              fim={novo.ends_at}
              banners={banners}
              ignorarId={null}
            />
            <p className="mt-1 text-xs text-slate-400">
              Tamanho da arte para este espaço: <strong>{arteDoEspaco(novo.slot)}</strong>
              {novo.slot !== "topo" && " (faixa baixa, para não empurrar os produtos)"}
            </p>
            <PrecoSugerido
              categoria={categories.find((c) => c.slug === novo.category_slug)}
              slot={novo.slot}
              precos={precos}
            />
          </div>
        )}

        {/* PERÍODO CONTRATADO. Fica visível para qualquer banner (dá para
            agendar um do carrossel também), mas é na categoria que ele decide
            quem pode ocupar o espaço. */}
        <label className="text-sm text-slate-600">
          Começa em (opcional)
          <input
            type="date"
            value={novo.starts_at}
            onChange={(e) =>
              setNovo({
                ...novo,
                starts_at: e.target.value,
                ends_at: fimDoPeriodo(e.target.value, novo.duracao) || novo.ends_at,
              })
            }
            className={`mt-1 block w-full ${campo}`}
          />
        </label>
        <label className="text-sm text-slate-600">
          Termina em (opcional)
          <input
            type="date"
            value={novo.ends_at}
            onChange={(e) => setNovo({ ...novo, ends_at: e.target.value })}
            className={`mt-1 block w-full ${campo}`}
          />
        </label>

        {/* COBRANÇA — o valor entra AQUI, junto do banner (22/08/2026).
            Aparece só quando o banner é pago E tem loja: sem uma das duas
            coisas não há o que cobrar nem de quem. O valor vem preenchido da
            tabela de preços e pode ser alterado — negociação existe. */}
        {/* ⚠ CLIENTE, "É PAGO" E VALOR NO MESMO BLOCO (22/08/2026). Ele não achou
            onde digitar o preço, e com razão: o campo só aparecia depois de
            marcar "é publicidade paga" (que estava no TOPO) e escolher a loja
            (que estava no FIM, dentro do destino). Escolhia a loja lá embaixo e
            o campo de preço nascia acima, fora da vista.
            💡 Campo que depende de outro tem de ficar ao lado dele. */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
          <p className="mb-2 text-xs font-semibold text-slate-700">
            Quem paga por este espaço
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-slate-600">
              Cliente
              <select
                value={novo.store_id}
                onChange={(e) => setNovo({ ...novo, store_id: e.target.value })}
                className={`mt-1 block w-full ${campo}`}
              >
                <option value="">— nenhum, é do próprio site —</option>
                {/* ⚠ DOIS GRUPOS: cliente e lead não são a mesma coisa. São 6
                    clientes contra 157 lojas que o coletor achou — despejar
                    tudo junto era procurar agulha no palheiro.
                    💡 Os leads continuam na lista de propósito: vender
                    publicidade é justamente como um lead vira cliente. */}
                {stores.some((s) => s.ehCliente) && (
                  <optgroup label="Clientes">
                    {stores
                      .filter((s) => s.ehCliente)
                      .map((s) => (
                        <option key={s.id} value={String(s.id)}>
                          {s.name}
                        </option>
                      ))}
                  </optgroup>
                )}
                {stores.some((s) => !s.ehCliente) && (
                  <optgroup label="Lojas do catálogo (ainda não são clientes)">
                    {stores
                      .filter((s) => !s.ehCliente)
                      .map((s) => (
                        <option key={s.id} value={String(s.id)}>
                          {s.name}
                          {s.temProduto === false ? "  (sem produto no site)" : ""}
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>
            </label>
            <label className="flex items-end gap-2 pb-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={novo.is_paid}
                onChange={(e) => {
                  const pago = e.target.checked;
                  // Ao marcar como pago, já traz o preço de tabela — é o número
                  // que ele vai falar para o cliente.
                  setNovo({
                    ...novo,
                    is_paid: pago,
                    valor: pago && !novo.valor ? String(precoDeTabela(novo, novo.duracao) ?? "") : novo.valor,
                  });
                }}
              />
              É publicidade paga
            </label>
          </div>

        {novo.is_paid && novo.store_id && (
          <div className="mt-3 rounded-lg border border-brand-green bg-brand-green-light p-2.5">
            <p className="mb-2 text-xs font-semibold text-brand-green-dark">
              Entra na conta de{" "}
              {stores.find((s) => String(s.id) === novo.store_id)?.name ?? "cliente"}
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs text-slate-600">
                Por quanto tempo
                <select
                  value={novo.duracao}
                  onChange={(e) => {
                    const d = e.target.value;
                    // O término se calcula pela duração e continua editável.
                    const inicio = novo.starts_at || hoje();
                    setNovo({
                      ...novo,
                      duracao: d,
                      starts_at: inicio,
                      ends_at: fimDoPeriodo(inicio, d) || novo.ends_at,
                      valor: String(precoDeTabela(novo, d) ?? ""),
                    });
                  }}
                  className={`mt-1 block ${campo}`}
                >
                  <option value="mensal">Mensal</option>
                  <option value="trimestral">Trimestral</option>
                  <option value="semestral">Semestral</option>
                  <option value="avulso">Avulso (valor livre)</option>
                </select>
              </label>
              <label className="text-xs text-slate-600">
                Valor a cobrar (US$)
                <input
                  type="number"
                  step="0.01"
                  value={novo.valor}
                  onChange={(e) => setNovo({ ...novo, valor: e.target.value })}
                  placeholder="0,00"
                  className={`mt-1 block w-32 ${campo}`}
                />
              </label>
              {precoDeTabela(novo, novo.duracao) != null && (
                <button
                  type="button"
                  onClick={() => setNovo({ ...novo, valor: String(precoDeTabela(novo, novo.duracao)) })}
                  className="mb-1 text-xs font-medium text-brand-navy hover:underline"
                >
                  usar o preço de tabela (US$ {precoDeTabela(novo, novo.duracao)})
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {Number(novo.valor) > 0
                ? "Ao criar, este valor entra na conta do cliente automaticamente."
                : "Deixe em branco para criar o banner sem cobrar agora."}
            </p>
          </div>
        )}

          {novo.is_paid && !novo.store_id && (
            <p className="mt-2 text-xs text-amber-700">
              Escolha o cliente acima para poder lançar o valor na conta dele.
            </p>
          )}
        </div>

        {/* ⚠ A IMAGEM VEM DEPOIS DO ESPAÇO — e isto era um DEFEITO, não só
            desorganização (achado em 22/08/2026). O envio ajusta a arte ao
            formato do espaço escolhido; com a imagem no topo do formulário, ela
            era recortada para 858×375 (o padrão) mesmo quando o destino era a
            faixa fina de 818×137. A arte saía no formato errado e só se
            descobria olhando o banner publicado. */}
        <div className="sm:col-span-2">
          <label className="block text-sm text-slate-600">Imagem</label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input type="file" accept="image/*" onChange={onFile} className="text-sm" />
            {uploading && <span className="text-xs text-slate-400">enviando…</span>}
            <span className="text-xs text-slate-400">ou cole uma URL:</span>
            <input
              value={novo.image_url}
              onChange={(e) => setNovo({ ...novo, image_url: e.target.value })}
              placeholder="/media/... ou https://..."
              className={`flex-1 ${campo}`}
            />
          </div>
          {aviso && (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {aviso}
            </p>
          )}
          {novo.image_url && (
            <div className="mt-2">
              <p className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">
                como vai aparecer
              </p>
              {/* ⚠ A PRÉVIA NO FORMATO DE VERDADE. Antes era uma miniatura de
                  altura fixa (h-20) que não parecia com nada do que ia ao ar —
                  a faixa fina só se revelava depois de publicada. */}
              <div
                style={{
                  aspectRatio:
                    novo.placement === "category" && novo.slot !== "topo" ? "818 / 137" : "858 / 375",
                }}
                className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={novo.image_url} alt="" className="h-full w-full object-cover" />
              </div>
            </div>
          )}
        </div>


        {err && !editando && <p className="text-sm text-red-600 sm:col-span-2">{err}</p>}
        <div className="sm:col-span-2">
          <button
            disabled={saving}
            className="rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green-dark disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Criar banner"}
          </button>
        </div>
      </form>
      )}

      {/* BARRA DE FILTROS (21/08/2026) — procurar por título ou loja, e os
          atalhos por tipo. A contagem em cada aba é o que dá o panorama num
          olhar: quantos espaços de categoria já estão vendidos.
          ⚠ "Vencendo em 7 dias" não estava no pedido dele, mas é o que evita
          perder renovação — sem isso um contrato acaba no dia 30 e ninguém vê. */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            placeholder="procurar por título, loja ou categoria…"
            className={`w-full pl-9 ${campo}`}
          />
          {filtroTexto && (
            <button
              type="button"
              onClick={() => setFiltroTexto("")}
              aria-label="limpar"
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
            </button>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setFiltroTipo(a.id)}
            className={`rounded-full px-3 py-1 text-xs transition ${
              filtroTipo === a.id
                ? "bg-brand-navy font-semibold text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            } ${a.id === "vencendo" && a.n > 0 && filtroTipo !== a.id ? "ring-1 ring-amber-400" : ""}`}
          >
            {a.rotulo} <span className="opacity-70">{a.n}</span>
          </button>
        ))}
      </div>

      <p className="mt-4 text-xs text-slate-400">
        A ordem da lista é a ordem em que os banners passam no carrossel. Use as setas para mudar.
        Os cliques são dos últimos 30 dias.
      </p>
      <ul className="mt-2 space-y-2">
        {banners.length === 0 && <li className="text-sm text-slate-500">Nenhum banner ainda.</li>}
        {banners.length > 0 && bannersVisiveis.length === 0 && (
          <li className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
            Nenhum banner encontrado com esse filtro.
            <button
              type="button"
              onClick={() => {
                setFiltroTexto("");
                setFiltroTipo("todos");
              }}
              className="ml-2 font-medium text-brand-navy hover:underline"
            >
              limpar filtros
            </button>
          </li>
        )}
        {bannersVisiveis.map((b) => {
          const pos = posicaoNoGrupo.get(b.id) ?? { primeiro: true, ultimo: true };
          const setaCls =
            "flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500 transition hover:border-brand-green hover:text-brand-green-dark disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300";

          // Editando: a linha vira formulário no lugar, sem janela flutuante.
          // Em janela o painel fica ruim no celular — a pessoa perde a
          // referência de qual banner está mexendo.
          if (editando === b.id && rascunho) {
            return (
              <li key={b.id} className="rounded-xl border-2 border-brand-green bg-brand-green-light/20 p-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand-green-dark">
                  Editando banner
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-slate-600">
                    Título
                    <input
                      value={rascunho.title}
                      onChange={(e) => setRascunho({ ...rascunho, title: e.target.value })}
                      className={`mt-1 block w-full ${campo}`}
                    />
                  </label>
                  {/* Cliente e "é pago" juntos, como no formulário de criar.
                      Na edição não há campo de valor: o que já foi cobrado está
                      no item de venda, e reescrevê-lo aqui mudaria o passado. */}
                  <label className="text-sm text-slate-600">
                    Cliente
                    <select
                      value={rascunho.store_id}
                      onChange={(e) => setRascunho({ ...rascunho, store_id: e.target.value })}
                      className={`mt-1 block w-full ${campo}`}
                    >
                      <option value="">— nenhum, é do próprio site —</option>
                      {stores.map((s) => (
                        <option key={s.id} value={String(s.id)}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 self-end text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={rascunho.is_paid}
                      onChange={(e) => setRascunho({ ...rascunho, is_paid: e.target.checked })}
                    />
                    É publicidade paga
                  </label>

                  <div className="sm:col-span-2">
                    <label className="block text-sm text-slate-600">Imagem</label>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={rascunho.image_url} alt="" className="h-14 w-24 rounded object-cover" />
                      <input type="file" accept="image/*" onChange={trocarImagem} className="text-sm" />
                      {uploading && <span className="text-xs text-slate-400">enviando…</span>}
                    </div>
                  </div>

                  <CamposDeDestino d={rascunho} set={setRascunho} stores={stores} />

                  <label className="text-sm text-slate-600">
                    Onde aparece
                    <select
                      value={rascunho.placement}
                      onChange={(e) => setRascunho({ ...rascunho, placement: e.target.value })}
                      className={`mt-1 block w-full ${campo}`}
                    >
                      <option value="home_hero">Topo da home (carrossel)</option>
                      <option value="category">Páginas de categoria e busca</option>
                      <option value="video_flutuante">Vídeo flutuante na home (ao vivo)</option>
                      <option value="restaurante">Onde comer no Paraguai (home)</option>
                    </select>
                  </label>
                  {rascunho.placement === "restaurante" && (
                    <label className="text-sm text-slate-600">
                      Cidade
                      <input
                        value={rascunho.cidade}
                        onChange={(e) => setRascunho({ ...rascunho, cidade: e.target.value })}
                        placeholder="Ciudad del Este, Salto del Guairá…"
                        className={`mt-1 block w-full ${campo}`}
                      />
                    </label>
                  )}
                  {rascunho.placement === "category" && (
                    <div className="text-sm text-slate-600">
                      Categoria
                      <div className="mt-1">
                        <EscolherCategoria
                          categorias={categories}
                          valor={rascunho.category_slug}
                          onChange={(slug) => setRascunho({ ...rascunho, category_slug: slug })}
                          ocupadas={ocupadas}
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {ESPACOS.map((e) => (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => setRascunho({ ...rascunho, slot: e.id })}
                            title={e.ajuda}
                            className={`rounded-full px-3 py-1 text-xs transition ${
                              rascunho.slot === e.id
                                ? "bg-brand-navy font-semibold text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {e.rotulo}
                          </button>
                        ))}
                      </div>
                      <AvisoOcupada
                        slug={rascunho.category_slug}
                        slot={rascunho.slot}
                        inicio={rascunho.starts_at}
                        fim={rascunho.ends_at}
                        banners={banners}
                        ignorarId={b.id}
                      />
                      <p className="mt-1 text-xs text-slate-400">
                        Tamanho da arte: <strong>{arteDoEspaco(rascunho.slot)}</strong>
                      </p>
                      <PrecoSugerido
                        categoria={categories.find((c) => c.slug === rascunho.category_slug)}
                        slot={rascunho.slot}
                        precos={precos}
                      />
                    </div>
                  )}

                  <label className="text-sm text-slate-600">
                    Começa em (opcional)
                    <input
                      type="date"
                      value={rascunho.starts_at}
                      onChange={(e) => setRascunho({ ...rascunho, starts_at: e.target.value })}
                      className={`mt-1 block w-full ${campo}`}
                    />
                  </label>
                  <label className="text-sm text-slate-600">
                    Termina em (opcional)
                    <input
                      type="date"
                      value={rascunho.ends_at}
                      onChange={(e) => setRascunho({ ...rascunho, ends_at: e.target.value })}
                      className={`mt-1 block w-full ${campo}`}
                    />
                  </label>

                  {err && <p className="text-sm text-red-600 sm:col-span-2">{err}</p>}
                  <div className="flex gap-2 sm:col-span-2">
                    <button
                      onClick={() => salvarEdicao(b.id)}
                      disabled={saving}
                      className="rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green-dark disabled:opacity-60"
                    >
                      {saving ? "Salvando…" : "Salvar"}
                    </button>
                    <button
                      onClick={() => {
                        setEditando(null);
                        setRascunho(null);
                        setErr(null);
                      }}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </li>
            );
          }

          return (
            <li key={b.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
              {/* Setas empilhadas em vez de arrastar: no celular arrastar item de
                  lista é impreciso, e o painel é usado bastante pelo telefone. */}
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => mover(b.id, "up")}
                  disabled={pos.primeiro || movendo === b.id}
                  title="Subir"
                  aria-label="Subir"
                  className={setaCls}
                >
                  ↑
                </button>
                <button
                  onClick={() => mover(b.id, "down")}
                  disabled={pos.ultimo || movendo === b.id}
                  title="Descer"
                  aria-label="Descer"
                  className={setaCls}
                >
                  ↓
                </button>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.image_url} alt="" className="h-12 w-20 rounded object-cover" />
              <div className="flex-1 text-sm">
                <div className="font-medium text-slate-800">{b.title || "(sem título)"}</div>
                <div className="text-xs text-slate-400">
                  {b.placement === "category"
                    ? `Categoria: ${b.category_slug} · ${b.slot ?? "topo"}`
                    : b.placement === "video_flutuante"
                      ? "Vídeo flutuante"
                      : "Topo da home"}
                  {b.store_name ? ` · ${b.store_name}` : ""}
                  {b.is_paid ? " · Pago" : ""}
                  {b.active ? "" : " · inativo"}
                  {(b.starts_at || b.ends_at) &&
                    ` · ${dataBonita(b.starts_at) || "início livre"} a ${dataBonita(b.ends_at) || "sem fim"}`}
                </div>
                {/* ⚠ O BURACO QUE ELE APONTOU: banner no ar sem estar cobrado.
                    Antes as duas telas não se falavam e dava para publicar sem
                    lançar na conta — dinheiro que ninguém cobra. */}
                {b.is_paid === 1 && (
                  <div className="mt-0.5 text-xs">
                    {b.pedido_numero ? (
                      <span className="text-brand-green-dark">
                        ✓ na conta · pedido {b.pedido_numero}
                        {b.pedido_valor != null &&
                          ` · ${Number(b.pedido_valor).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "USD",
                          })}`}
                      </span>
                    ) : (
                      <button
                        onClick={() => lancarNaConta(b)}
                        disabled={saving}
                        className="rounded-md bg-amber-100 px-2 py-0.5 font-medium text-amber-900 hover:bg-amber-200 disabled:opacity-60"
                      >
                        ⚠ ainda não está na conta — lançar
                      </button>
                    )}
                  </div>
                )}
                {/* Para onde o clique leva, escrito por extenso: é a dúvida que
                    mais aparece depois que a regra virou automática. */}
                <div className="mt-0.5 text-xs text-slate-400">{descreverDestino(b)}</div>
              </div>
              {/* O número que o anunciante pede na hora de renovar. */}
              <div className="w-16 text-center">
                <div className="text-sm font-semibold text-brand-navy">{b.cliques30 ?? 0}</div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400">cliques</div>
              </div>
              <button
                onClick={() => abrirEdicao(b)}
                className="text-xs font-medium text-brand-green-dark hover:underline"
              >
                Editar
              </button>
              <button
                onClick={() => toggle(b.id, b.active)}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                {b.active ? "Desativar" : "Ativar"}
              </button>
              <button onClick={() => remove(b.id)} className="text-xs text-red-500 hover:text-red-700">
                Excluir
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
