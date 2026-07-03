import Link from 'next/link';

export const metadata = { title: 'Boletim do dia — Praça Araguaia' };

export default function Boletim() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">← Voltar</Link>
      <h1 className="mt-2 text-2xl font-bold text-neutral-900">Boletim do dia</h1>
      <p className="mt-1 text-sm text-neutral-500">Baixe a imagem e compartilhe no Instagram ou WhatsApp.</p>

      {/* Imagem dinâmica gerada pela rota; next/image não otimiza rota própria. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/api/boletim"
        alt="Boletim do dia com as cotações da Praça Araguaia"
        className="mt-6 w-full max-w-xl rounded-2xl border border-neutral-200 shadow-sm"
      />

      <a
        href="/api/boletim"
        download="boletim-praca-araguaia.png"
        className="mt-4 inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
      >
        Baixar imagem
      </a>
    </main>
  );
}
