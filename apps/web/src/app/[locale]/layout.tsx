import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ServiceWorker } from "@/components/ServiceWorker";
import { InstallApp } from "@/components/InstallApp";
import "../globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "iCompras — Comparador de precios",
  description: "Compará precios de las mejores tiendas del Paraguay.",
  // Instalação na tela do celular (PWA). O <link rel="manifest"> é colocado
  // automaticamente a partir de src/app/manifest.ts.
  //
  // NÃO declarar `icons` aqui: isso substitui a detecção automática dos
  // arquivos src/app/icon.png e src/app/apple-icon.png e derruba o favicon.
  appleWebApp: { capable: true, title: "iCompras", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#123a5e", // azul-marinho da marca, usado na barra do celular
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <ServiceWorker />
          <InstallApp locale={locale} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
