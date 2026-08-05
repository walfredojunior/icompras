import { EsqueletoTitulo, EsqueletoCartoes } from "@/components/Esqueleto";

// Rede de segurança: vale para qualquer página que não tenha um esqueleto
// próprio (a home, por exemplo). Em navegação rápida nem chega a piscar.
export default function Carregando() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <EsqueletoTitulo largura="w-64" />
      <div className="mt-8">
        <EsqueletoCartoes n={6} />
      </div>
    </div>
  );
}
