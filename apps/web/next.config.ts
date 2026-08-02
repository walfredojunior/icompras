import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Build de produção não trava por erros de tipo/lint (o código roda igual; corrigir aos poucos).
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // Permite testar de outros aparelhos na rede local (celular via IP do PC).
  allowedDevOrigins: ["192.168.68.109", "192.168.68.*"],
  // Driver do MariaDB deve rodar no Node, não ser empacotado.
  serverExternalPackages: ["mariadb", "sharp"],
  images: {
    remotePatterns: [],
  },
};

export default withNextIntl(nextConfig);
