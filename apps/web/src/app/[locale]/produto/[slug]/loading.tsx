import { EsqueletoProduto } from "@/components/Esqueleto";

// Aparece no INSTANTE do clique, enquanto o servidor monta a página.
// Sem isto, o navegador ficava na página antiga por ~2 segundos e dava a
// impressão de que o clique não tinha funcionado.
export default function Carregando() {
  return <EsqueletoProduto />;
}
