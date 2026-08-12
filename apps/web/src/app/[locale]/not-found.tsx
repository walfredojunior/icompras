import { Link } from "@/i18n/navigation";

// Página de "não encontrado" — e, principalmente, o `noindex` dela.
//
// ⚠ POR QUE ISTO EXISTE (11/08/2026). Nesta versão do Next, `notFound()`
// chamado de dentro de uma página devolve o CORPO certo mas o STATUS 200: os
// metadados são enviados antes de a página decidir, e o cabeçalho já saiu.
// Medido em todo o site:
//     /produto/nao-existe → 200 · /categorias/nao-existe → 200 · /loja/... → 200
//
// A opção documentada para desligar o envio antecipado (`htmlLimitedBots`) NÃO
// existe nesta versão — o Next recusa a chave. Então o status continua 200, e
// o que dá para garantir é que o Google **não guarde** essas páginas: um site
// com 270 mil endereços que responde "existe" para qualquer coisa inventada
// pode ter lixo sem fim indexado.
//
// Quando a versão do Next passar a devolver 404 de verdade, este arquivo pode
// ficar — ele continua sendo a tela certa para quem cai aqui.
export const metadata = {
  title: "Página não encontrada",
  robots: { index: false, follow: false },
};

export default function NaoEncontrado() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <p className="text-5xl font-bold text-slate-200">404</p>
      <h1 className="mt-4 text-xl font-bold text-slate-900">Não encontramos esta página</h1>
      <p className="mt-2 text-sm text-slate-500">
        O endereço pode estar errado, ou o produto pode não estar mais disponível em nenhuma loja.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-brand-green px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-green-dark"
      >
        Voltar ao início
      </Link>
    </div>
  );
}
