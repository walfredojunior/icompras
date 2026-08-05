import { EsqueletoTitulo, EsqueletoCartoes } from "@/components/Esqueleto";

export default function Carregando() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <EsqueletoTitulo largura="w-72" />
      <div className="mt-6">
        <EsqueletoCartoes n={12} />
      </div>
    </div>
  );
}
