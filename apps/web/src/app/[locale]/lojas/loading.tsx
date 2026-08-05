import { EsqueletoTitulo, EsqueletoCartoes } from "@/components/Esqueleto";

export default function Carregando() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <EsqueletoTitulo />
      <div className="mt-6">
        <EsqueletoCartoes n={8} colunas="sm:grid-cols-3 lg:grid-cols-4" />
      </div>
    </div>
  );
}
